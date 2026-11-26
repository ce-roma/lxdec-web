# LXDEC OS ISO Builder (`26.11-deb13` — Debian 13 Trixie)

Receta declarativa de **`live-build`** para compilar la imagen ISO híbrida (UEFI + BIOS) de **LXDEC OS** basada en **Debian 13 (`trixie`)**, con escritorio **XFCE**, instalador gráfico **Calamares**, repositorio oficial **PGDG**, tuning de kernel (`99-lxdec.conf`) y stack nativo para Ingenieros de Datos, DBAs y Desarrolladores Backend.

---

## 1. Descargar Debian 13 (`trixie`) para tu VM `lxdec-builder`

Descarga la imagen `netinst` actual de **Debian 13 (`trixie`)**:
* [https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/](https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/)
  *(Archivo `debian-13.x.x-amd64-netinst.iso`).*

Crea la VM `lxdec-builder` en `virt-manager` (8 GB RAM, 4–6 vCPUs, 40 GB disco) marcando **solo `servidor SSH` y `utilidades estándar`** durante el instalador.

---

## 2. Instalar dependencias dentro de la VM Debian 13

```bash
sudo apt update && sudo apt install -y \
  live-build debootstrap squashfs-tools xorriso \
  isolinux syslinux-efi grub-pc-bin grub-efi-amd64-bin \
  mtools dosfstools git curl
```

---

## 3. Copiar esta carpeta a la VM y compilar la ISO

Desde tu máquina Arch (o clonando tu repo en la VM):
```bash
scp -r /home/eroblesp/prj/lxdec/iso-builder tu_usuario@IP_DE_LA_VM:~/
```

Dentro de la VM `lxdec-builder`:
```bash
cd ~/iso-builder
chmod +x build.sh
sudo ./build.sh
```

Al finalizar (tarda ~10–15 minutos según tu conexión), tendrás listos:
* `lxdec-os-26.11-deb13-amd64.iso`
* `lxdec-os-26.11-deb13-amd64.iso.sha256`

Trae la ISO de vuelta a tu Arch host con `scp` y pruébala en una nueva VM limpia de `virt-manager` con firmware **UEFI (`OVMF`)**.

