// Offline native smoke fixture. Its download subprocess is the real installed FFmpeg.
use std::{env, io::{self, Write}, os::windows::process::CommandExt, process::Command, thread, time::Duration};
fn main() {
    let args: Vec<_> = env::args().skip(1).collect();
    if args.iter().any(|a| a == "--version") {
        if std::path::Path::new(&env::var("VETCH101_TEST_SLOW_PROBE").unwrap()).exists() {
            thread::sleep(Duration::from_secs(3));
        }
        println!("2026.09.06-test");
    } else if args.iter().any(|a| a == "-U") {
        thread::sleep(Duration::from_secs(3));
        println!("Fixture update complete");
    } else if args.iter().any(|a| a == "--dump-single-json") {
        let id = if args.last().unwrap().ends_with("/A") { "A" } else { "B" };
        if id == "A" { thread::sleep(Duration::from_millis(1200)); }
        println!(r#"{{"id":"{id}","title":"Fixture {id}","thumbnail":"","duration":60,"formats":[{{"vcodec":"h264","acodec":"aac","height":720,"ext":"mp4"}}]}}"#);
    } else {
        let mut child = Command::new(env::var("VETCH101_TEST_FFMPEG").unwrap())
            .args(["-nostdin", "-hide_banner", "-loglevel", "error", "-re", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "60", "-f", "null", "-"])
            .creation_flags(0x08000000).spawn().unwrap();
        std::fs::write(env::var("VETCH101_TEST_CHILD_PID").unwrap(), child.id().to_string()).unwrap();
        println!("download:10.0%|1MiB/s|00:60");
        io::stdout().flush().unwrap();
        child.wait().unwrap();
    }
}
