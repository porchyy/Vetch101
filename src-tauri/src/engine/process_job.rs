//! Install before spawning any threads or children. Windows owns cleanup on exit/crash.
use std::{
    io,
    mem::{size_of, zeroed},
    os::windows::io::{AsRawHandle, FromRawHandle, IntoRawHandle, OwnedHandle},
};
use windows_sys::Win32::System::{
    JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    },
    Threading::GetCurrentProcess,
};

pub fn bind_process_tree() -> io::Result<()> {
    // SAFETY: valid non-inheritable handle; initialized limit struct lives through the call.
    unsafe {
        let raw = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if raw.is_null() {
            return Err(io::Error::last_os_error());
        }
        let job = OwnedHandle::from_raw_handle(raw);
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = zeroed();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            job.as_raw_handle(),
            JobObjectExtendedLimitInformation,
            &limits as *const _ as *const _,
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        ) == 0
            || AssignProcessToJobObject(job.as_raw_handle(), GetCurrentProcess()) == 0
        {
            return Err(io::Error::last_os_error());
        }
        // Process-lifetime handle, deliberately not dropped: closing it kills this app too.
        // It is not inherited. Windows closes the last handle even after a forced crash.
        let _ = job.into_raw_handle();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{BufRead, BufReader, Write},
        os::windows::process::CommandExt,
        process::{Command, Stdio},
        time::Duration,
    };
    use windows_sys::Win32::{
        Foundation::{CloseHandle, WAIT_OBJECT_0},
        System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE},
    };

    #[test]
    fn process_tree_dies_when_owner_exits_or_crashes() {
        if let Ok(mode) = std::env::var("VETCH101_JOB_TEST_HELPER") {
            bind_process_tree().unwrap();
            let mut child = Command::new("powershell.exe")
                .args(["-NoProfile", "-Command", "$p = Start-Process ping.exe -ArgumentList '-t 127.0.0.1' -WindowStyle Hidden -PassThru; Write-Output $p.Id; Start-Sleep -Seconds 60"])
                .creation_flags(0x08000000).stdout(Stdio::piped()).spawn().unwrap();
            let mut grandchild = String::new();
            BufReader::new(child.stdout.take().unwrap())
                .read_line(&mut grandchild)
                .unwrap();
            println!("TREE:{}:{}", child.id(), grandchild.trim());
            std::io::stdout().flush().unwrap();
            // Parent sends a byte only after obtaining process handles for both descendants.
            let mut ready = String::new();
            std::io::stdin().read_line(&mut ready).unwrap();
            if mode == "exit" {
                std::process::exit(0);
            }
            std::thread::sleep(Duration::from_secs(60));
            panic!("parent did not terminate crash helper");
        }
        for mode in ["exit", "crash"] {
            let mut owner = Command::new(std::env::current_exe().unwrap())
                .args([
                    "--exact",
                    "engine::process_job::tests::process_tree_dies_when_owner_exits_or_crashes",
                    "--nocapture",
                ])
                .env("VETCH101_JOB_TEST_HELPER", mode)
                .creation_flags(0x08000000)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .spawn()
                .unwrap();
            let line = BufReader::new(owner.stdout.take().unwrap())
                .lines()
                .map(Result::unwrap)
                .find(|line| line.starts_with("TREE:"))
                .expect("helper tree");
            let handles: Vec<_> = line
                .split(':')
                .skip(1)
                .map(|pid| unsafe {
                    let handle = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid.parse().unwrap());
                    assert!(
                        !handle.is_null(),
                        "descendant must be alive before owner terminates"
                    );
                    handle
                })
                .collect();
            owner.stdin.take().unwrap().write_all(b"ready\n").unwrap();
            if mode == "crash" {
                owner.kill().unwrap();
            }
            owner.wait().unwrap();
            for handle in handles {
                unsafe {
                    let result = WaitForSingleObject(handle, 10_000);
                    CloseHandle(handle);
                    assert_eq!(result, WAIT_OBJECT_0, "descendant survived {mode}");
                }
            }
        }
    }
}
