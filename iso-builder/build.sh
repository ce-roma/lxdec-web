#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# LXDEC OS (26.11-deb13) — Debian 13 (Trixie) live-build Master Script
# Run inside a Debian 13 (Trixie) VM: sudo ./build.sh
# ==============================================================================

DISTRO_VERSION="26.11-deb13"
DEBIAN_SUITE="trixie"
ISO_NAME="lxdec-os-${DISTRO_VERSION}-amd64.iso"

if [[ "${EUID}" -ne 0 ]]; then
  echo "[ERROR] Ejecuta este script como root: sudo ./build.sh"
  exit 1
fi

echo "==> [1/4] Limpiando compilaciones previas..."
lb clean --purge || true

echo "==> [2/4] Configurando Debian ${DEBIAN_SUITE} (live-build)..."
lb config \
  --distribution "${DEBIAN_SUITE}" \
  --architectures amd64 \
  --archive-areas "main contrib non-free-firmware" \
  --binary-images iso-hybrid \
  --bootloaders "syslinux,grub-efi" \
  --debian-installer false \
  --apt-indices true \
  --apt-recommends true \
  --memtest none \
  --iso-application "LXDEC OS ${DISTRO_VERSION}" \
  --iso-publisher "LXDEC OS Project (Independent Debian-based derivative)" \
  --iso-volume "LXDEC_26_11_DEB13" \
  --bootappend-live "boot=live components quiet splash locales=es_MX.UTF-8 keyboard-layouts=latam"

# Ensure hooks are executable
chmod +x config/hooks/live/*.hook.chroot 2>/dev/null || true

# Copy the robot-head logo from the web portal into Calamares branding if present
if [[ -f "../app/static/img/logo.svg" ]]; then
  mkdir -p config/includes.chroot/etc/calamares/branding/lxdec
  cp ../app/static/img/logo.svg config/includes.chroot/etc/calamares/branding/lxdec/logo.svg
fi

echo "==> [3/4] Construyendo sistema Live + SquashFS + ISO híbrida (UEFI + BIOS)..."
lb build

echo "==> [4/4] Renombrando artefacto y generando checksum SHA-256..."
if [[ -f "live-image-amd64.hybrid.iso" ]]; then
  mv live-image-amd64.hybrid.iso "${ISO_NAME}"
  sha256sum "${ISO_NAME}" > "${ISO_NAME}.sha256"
  echo "======================================================================"
  echo " BUILD COMPLETADO EXITOSAMENTE"
  echo " ISO:    $(pwd)/${ISO_NAME}"
  echo " SHA256: $(cat "${ISO_NAME}.sha256")"
  echo "======================================================================"
else
  echo "[ERROR] No se generó live-image-amd64.hybrid.iso. Revisa build.log."
  exit 1
fi

