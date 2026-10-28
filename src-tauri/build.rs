fn main() {
    // Declare custom cfg(mobile) condition to satisfy Rust 1.80+ check-cfg validation
    println!("cargo::rustc-check-cfg=cfg(mobile)");
    tauri_build::build();
}
