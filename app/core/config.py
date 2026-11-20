from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    env: str = "production"
    port: int = 8080
    distro_name: str = "LXDEC OS"
    distro_version: str = "26.11-deb12"
    kernel_version: str = "6.11-bpo-amd64"
    iso_download_url: str = (
        "https://github.com/lxdec-os/releases/releases/latest/download/lxdec-os-26.11-deb12-amd64.iso"
    )
    iso_sha256: str = (
        "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    )
    iso_size_mb: int = 2640

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
