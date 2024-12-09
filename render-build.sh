#!/bin/bash

# Pretvaranje linijskih završetaka u LF format (ukoliko je potrebno)
sed -i 's/\r//' squashfs-root/AppRun

# Dodela izvršnih prava za AppRun fajl
chmod +x squashfs-root/AppRun

