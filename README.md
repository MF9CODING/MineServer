<div align="center">

![Mineserver Logo](https://raw.githubusercontent.com/MF9CODING/Mineserver/main/src-tauri/icons/icon.png)

# MineServer
### Protocol 1: Protect the Pilot. Protocol 2: Run the Server.
**The modern, lightning-fast Minecraft Server Manager you've been waiting for.**

[![Status](https://img.shields.io/badge/Status-Stable-green?style=for-the-badge&logo=github)](https://github.com/MF9CODING/Mineserver)
[![Downloads](https://img.shields.io/github/downloads/MF9CODING/Mineserver/total?style=for-the-badge&color=orange)](https://github.com/MF9CODING/Mineserver/releases)
[![Built With Rust](https://img.shields.io/badge/Backend-Rust-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![Powered By Tauri](https://img.shields.io/badge/Native-Tauri_v2-blue?style=for-the-badge&logo=tauri)](https://tauri.app/)

[**Download for Windows**](https://github.com/MF9CODING/Mineserver/releases/latest) • [**View Changelog**](https://github.com/MF9CODING/Mineserver/releases) • [**Report Bug**](https://github.com/MF9CODING/Mineserver/issues)
---
</div>

## 👋 Introduction

Welcome to **MineServer**. We believe running a Minecraft server shouldn't require a degree in networking or hours of config file editing. Whether you're a parent setting up a world for your kids, a streamer playing with viewers, or a power user managing a modded SMP, MineServer is built for **you**.

Powered by **Rust** 🦀 and **Tauri** 🚀, it's incredibly lightweight (using less RAM than a web browser tab) while giving you professional-grade tools wrapped in a beautiful, modern interface.

## 🌟 Why MineServer?

### 🚀 **Performance First**
Forget clunky Electron apps that eat your RAM. MineServer is native. It opens instantly, runs silently in the background, and leaves your system resources free for what matters—gaming.

### 🛡️ **Security Center (Guardian)**
We take security seriously. With features like **Tunnel Guard**, we actively monitor connections to ensure your home network stays safe while you play with friends. The built-in **Panic Mode** lets you instantly lock down your server if griefers join.

### 🎥 **Streamer Friendly**
Streaming? Turn on **Streamer Mode** to automatically mask your Public IP, coordinates, and sensitive server details from your dashboard. Show your screen without fear of leaking your IP.

---

## 🔥 Key Features

### �️ **Server Management**
- **Smart Creation Wizard**: Automatically detects your hardware (CPU/RAM) to recommend the perfect settings.
- **Multi-Platform Support**: Run anything from **Vanilla** and **Paper** (Java) to **Bedrock (BDS)** and **NukkitX**.
- **Version Manager**: One-click install for ANY Minecraft version, from 1.16 to the latest Snapshot.
- **Live Console**: A premium terminal experience with color-coded logs, command history, and auto-scroll.

### 🌍 **Networking Made Easy**
- **No Port Forwarding? No Problem**: Built-in support for **Playit.gg** tunneling means you can let friends join without touching your router settings.
- **UPnP Support**: Automatically opens ports on compatible routers for a direct connection.
- **Lan Mode**: Instantly shows your local IP for family play.

### 🧩 **Plugin & Mod Powerhouse**
- **Integrated App Store**: Browse, search, and install thousands of plugins directly from **Modrinth**, **Hangar**, **SpigotMC**, and **Polymart**.
- **Safe Installs**: We automatically place files in the right folders (plugins/mods) so you don't have to.
- **Nukkit Support**: Full support for installing plugins on Nukkit servers.

### 🗺️ **World Command Center**
- **Visual Manager**: See your worlds with beautiful cards, not just folder names.
- **Regenerator**: Don't like your seed? Regenerate the world with a new seed and level type (Flat, Amplified, etc.) in seconds.
- **Dimension Control**: Upload or delete specific dimensions (Nether/End) without wiping the whole server.
- **Drag & Drop Import**: Drag a `.zip` or `.mcworld` file into the app to instantly import a world.

### � **Pro File Manager**
- **Code Editor**: A built-in editor with syntax highlighting for YAML, JSON, and Properties files. Fix configs without leaving the app.
- **Archive & Backup**: Zip up your server for safekeeping or extract downloaded backups with one click.
- **Recursive Uploads**: Upload entire folders seamlessly.

---

## 💻 Supported Software

We support the best high-performance server software out of the box:

| Platform | Type | Best For | Status |
|----------|------|----------|--------|
| **Paper** | Java | 🚀 High Performance & Plugins | ✅ Supported |
| **Purpur** | Java | ⚙️ Extreme Customization | ✅ Supported |
| **Vanilla** | Java | 🍦 Pure Experience | ✅ Supported |
| **Fabric** | Java | 🛠️ Mods (Lightweight) | ✅ Supported |
| **Forge** | Java | 🏗️ Heavy Modpacks | ✅ Supported |
| **NeoForge** | Java | ⚡ Modern Forge Fork (1.20.1+) | ✅ **NEW** |
| **Bedrock** | Bedrock | 📱 Cross-play w/ Consoles | ✅ Supported |
| **NukkitX** | Bedrock | 🔌 Bedrock with Plugins | ✅ Supported |

---

## 📋 Changelog

### v1.0.0 (February 2026) - Major Release 🎉

#### ✨ New Features
- **NeoForge Support**: Full support for NeoForge modded servers (modern Forge fork for 1.20.1+)
  - One-click installation with automatic installer execution
  - Integrated Mods tab with Modrinth search using `neoforge` loader filter
  - Auto-creates `mods` folder during server setup
- **Smart Run Script Detection**: NeoForge/Forge servers now automatically use `run.bat`/`run.sh` scripts
- **JVM Args via Environment**: Custom Java flags passed via `JVM_ARGS` environment variable for modded servers

#### 🐛 Bug Fixes
- Fixed compilation errors in scheduler thread lifetime management
- Fixed `window.emit` type mismatches in server runner
- Resolved unused import warnings throughout codebase

#### 🔧 Improvements
- Updated `ServerType` union to include `neoforge`
- ModManager now correctly detects NeoForge loader for Modrinth mod searches
- Mods tab now visible for NeoForge servers in Server Panel

---

## 📸 Screenshots

*(Screenshots coming soon - Imagine a sleek, dark-themed UI that looks like it's from 2030)*

---

## 🚀 Getting Started

1.  **Download**: Grab the latest `MineServer_x64-setup.exe` from the [Releases](https://github.com/MF9CODING/Mineserver/releases) page.
2.  **Install**: Run the installer.
    > 🛡️ **Security Warning? Don't Panic!**
    > You will likely see a **"Windows protected your PC"** popup. This happens because MineServer is a new open-source app and doesn't have an expensive corporate certificate yet.
    >
    > **To Install:**
    > 1. Click **<u>More info</u>** (the underlined text).
    > 2. Click the **Run anyway** button.
3.  **Create**: Click "Create Server", choose "Paper" (recommended), and hit "Start".
4.  **Play**: Copy the IP address shown in the Network tab and join!

---

## ❓ FAQ
**Q: Is this free?**
A: Yes! MineServer is 100% free and open source.

**Q: Can I run a server for my friends?**
A: Absolutely. MineServer is designed exactly for that. Use the "Playit" tunnel feature in the Network tab if you can't port forward.

**Q: How do I install plugins?**
A: Go to the "Plugins" tab in your server dashboard. You can search and install plugins directly from Modrinth, Spigot, and Hangar with one click. They are automatically placed in the correct folder.

**Q: Can I use mods?**
A: Yes! Select "Fabric" or "Forge" when creating a server. You can then use the built-in Mod Manager to find and install compatible mods.

**Q: Why can't my friends join?**
A: If you haven't port forwarded, they can't connect to your local IP. Use the "Network" tab and enable a "Playit.gg" tunnel to get a public address they can use instantly—no router access required.

**Q: Does it support Bedrock players?**
A: Yes! You can run a dedicated Bedrock server (BDS) or use NukkitX for plugin support. You can also run a Java server with the GeyserMC plugin to let Bedrock players join.

**Q: Where are my server files?**
A: In the "Files" tab, you can browse, edit, and manage all your server files. You can also click "Open Folder" to view them in Windows Explorer.

**Q: How much RAM should I allocate?**
A: For a small vanilla server, 2-4GB is usually enough. For modded servers or large plugin packs, we recommend 6-8GB or more. The "Create Server" wizard helps you choose this based on your PC's specs.

**Q: Can I import an existing world?**
A: Yes! Go to the "Worlds" tab and drag your world folder or zip file into the import area.

**Q: How do I back up my server?**
A: In the "Files" tab, select all files and click "Archive". This creates a zip backup you can save anywhere.

**Q: What is "Streamer Mode"?**
A: It hides sensitive info like your IP address and coordinates from the dashboard so you can safely show the app on stream without leaking private info.

**Q: My server crashes on startup!**
A: Check the "Console" tab for red error messages. Common issues are incompatible Java versions (e.g., using Java 8 for 1.20) or mismatched mods.

**Q: Do I need Java installed?**
A: MineServer attempts to use the Java installed on your system. We recommend installing **Java 21** (for 1.21+) and **Java 17** (for 1.18+) to ensure compatibility.

---

## ❤️ Contributing

We love the community! If you're a developer (Rust/React), come help us build the future of server management.

1.  Fork the repo.
2.  Create a branch (`git checkout -b feature/cool-thing`).
3.  Commit changes.
4.  Open a Pull Request!

---

<div align="center">

**Built with ❤️ by MF9CODING**

*Not affiliated with Mojang or Microsoft.*

</div>
