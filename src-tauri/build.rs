fn main() {
    // WinLibs GCC 16 injects a second manifest unconditionally. Override only its
    // endfile spec for this executable, retaining every other toolchain setting.
    if std::env::var("TARGET").unwrap().ends_with("windows-gnu") {
        let output = std::process::Command::new("gcc")
            .arg("-dumpspecs")
            .output()
            .expect("gcc specs");
        assert!(output.status.success(), "gcc -dumpspecs failed");
        let specs = String::from_utf8(output.stdout).expect("gcc specs UTF-8");
        let mut lines = specs.lines();
        lines
            .find(|line| *line == "*endfile:")
            .expect("gcc endfile spec");
        let endfile = lines.next().unwrap();
        let injected = "%{!shared:%:if-exists(default-manifest.o%s)}";
        if endfile.contains(injected) {
            let path = std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap())
                .join("vetch101.specs");
            std::fs::write(
                &path,
                format!("*endfile:\n{}\n\n", endfile.replace(injected, "")),
            )
            .unwrap();
            println!(
                "cargo:rustc-link-arg-bin=vetch101=-specs={}",
                path.display()
            );
        }
    }
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new()
                .app_manifest(include_str!("windows-app-manifest.xml")),
        ),
    )
    .expect("Tauri build failed");
}
