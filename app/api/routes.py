import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import RedirectResponse

from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["lxdec-topology"])

MANIFEST_PATH = Path(__file__).resolve().parent.parent / "data" / "manifest.json"

_manifest_cache: dict[str, Any] = {}
_manifest_mtime: float = 0.0


def get_manifest() -> dict[str, Any]:
    """Load manifest.json and automatically reload if the file was modified on disk."""
    global _manifest_cache, _manifest_mtime
    current_mtime = MANIFEST_PATH.stat().st_mtime
    if not _manifest_cache or current_mtime != _manifest_mtime:
        with MANIFEST_PATH.open("r", encoding="utf-8") as f:
            _manifest_cache = json.load(f)
        _manifest_mtime = current_mtime
    return _manifest_cache


def apply_edge_cache(response: Response) -> None:
    """Enable Vercel / CDN Edge caching in production while keeping instant reload in local dev."""
    if settings.env.lower() == "production":
        response.headers["Cache-Control"] = (
            "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
        )
    else:
        response.headers["Cache-Control"] = "no-cache"


@router.get("/topology")
async def get_topology(
    response: Response,
    category: str | None = Query(default=None, description="Filter by category ID"),
) -> dict[str, Any]:
    """Return the full D3.js topology graph (nodes, links, categories, and release info)."""
    apply_edge_cache(response)
    manifest = get_manifest()
    nodes = manifest["nodes"]
    links = manifest["links"]

    if category and category != "all":
        allowed_ids = {
            n["id"]
            for n in nodes
            if n["category"] == category or n["id"] == "lxdec-core"
        }
        nodes = [n for n in nodes if n["id"] in allowed_ids]
        links = [
            l
            for l in links
            if l["source"] in allowed_ids and l["target"] in allowed_ids
        ]

    return {
        "metadata": manifest["metadata"],
        "release": {
            "distro_name": settings.distro_name,
            "version": settings.distro_version,
            "kernel": settings.kernel_version,
            "iso_size_mb": settings.iso_size_mb,
            "iso_sha256": settings.iso_sha256,
            "iso_url": settings.iso_download_url,
            "download_endpoint": "/api/v1/download/latest",
        },
        "categories": manifest["categories"],
        "nodes": nodes,
        "links": links,
    }


@router.get("/node/{node_id}")
async def get_node_detail(node_id: str, response: Response) -> dict[str, Any]:
    """Return technical specifications and connected neighbors for a single topology node."""
    apply_edge_cache(response)
    manifest = get_manifest()
    node = next((n for n in manifest["nodes"] if n["id"] == node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in topology.")

    connected_links = [
        l
        for l in manifest["links"]
        if l["source"] == node_id or l["target"] == node_id
    ]
    return {
        "node": node,
        "connections": connected_links,
    }


@router.get("/release")
async def get_release_info(response: Response) -> dict[str, Any]:
    """Return metadata and checksums for the latest ISO build."""
    apply_edge_cache(response)
    return {
        "distro_name": settings.distro_name,
        "version": settings.distro_version,
        "kernel": settings.kernel_version,
        "iso_size_mb": settings.iso_size_mb,
        "sha256": settings.iso_sha256,
        "direct_url": settings.iso_download_url,
        "redirect_endpoint": "/api/v1/download/latest",
    }


@router.get("/download/latest")
async def download_latest_iso() -> RedirectResponse:
    """Offload ISO bandwidth to GitHub Releases or S3 via HTTP 302 Redirect."""
    headers = {}
    if settings.env.lower() == "production":
        headers["Cache-Control"] = "public, max-age=300, s-maxage=1800"
    return RedirectResponse(url=settings.iso_download_url, status_code=302, headers=headers)
