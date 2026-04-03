"""
Music API MCP Server

Exposes the FastAPI/GraphQL music service as MCP tools so that any
MCP-compatible AI client can browse and edit artists, albums, and songs.

Run:
    python mcp_server.py

The FastAPI app must be running at http://localhost:8000 (or set the
MUSIC_API_URL environment variable to point elsewhere).
"""

from __future__ import annotations

import json
import os
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.getenv("MUSIC_API_URL", "http://localhost:8000") + "/graphql"

mcp = FastMCP("Music API")


# ── Helpers ──────────────────────────────────────────────────────────────────


async def _gql(query: str, variables: dict | None = None) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            API_URL,
            json={"query": query, "variables": variables or {}},
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    if "errors" in data:
        raise RuntimeError(json.dumps(data["errors"]))
    return data["data"]


def _fmt(obj) -> str:
    return json.dumps(obj, indent=2)


# ── Artist tools ─────────────────────────────────────────────────────────────


@mcp.tool()
async def list_artists(genre: Optional[str] = None, search: Optional[str] = None) -> str:
    """List artists in the music database.

    Args:
        genre:  Filter by genre (partial, case-insensitive).
        search: Filter by artist name (partial, case-insensitive).
    """
    data = await _gql(
        """
        query($genre: String, $search: String) {
            artists(genre: $genre, search: $search) {
                id name genre formedYear bio
                albums { id title releaseYear }
            }
        }
        """,
        {"genre": genre, "search": search},
    )
    return _fmt(data["artists"])


@mcp.tool()
async def get_artist(id: int) -> str:
    """Get a single artist with all their albums and songs.

    Args:
        id: The artist's numeric ID.
    """
    data = await _gql(
        """
        query($id: Int!) {
            artist(id: $id) {
                id name genre formedYear bio
                albums {
                    id title releaseYear
                    songs { id title trackNumber duration }
                }
            }
        }
        """,
        {"id": id},
    )
    if data["artist"] is None:
        return f"No artist found with id={id}"
    return _fmt(data["artist"])


@mcp.tool()
async def create_artist(
    name: str,
    genre: Optional[str] = None,
    bio: Optional[str] = None,
    formed_year: Optional[int] = None,
) -> str:
    """Add a new artist to the database.

    Args:
        name:        Artist name (must be unique).
        genre:       Music genre (e.g. "Rock", "Jazz").
        bio:         Short biography.
        formed_year: Year the artist/band was formed.
    """
    data = await _gql(
        """
        mutation($input: ArtistInput!) {
            createArtist(input: $input) { id name genre formedYear bio }
        }
        """,
        {"input": {"name": name, "genre": genre, "bio": bio, "formedYear": formed_year}},
    )
    return _fmt(data["createArtist"])


@mcp.tool()
async def delete_artist(id: int) -> str:
    """Delete an artist and all their albums and songs.

    Args:
        id: The artist's numeric ID.
    """
    data = await _gql(
        "mutation($id: Int!) { deleteArtist(id: $id) }",
        {"id": id},
    )
    ok = data["deleteArtist"]
    return "Deleted." if ok else f"No artist found with id={id}"


# ── Album tools ──────────────────────────────────────────────────────────────


@mcp.tool()
async def list_albums(artist_id: Optional[int] = None) -> str:
    """List albums, optionally filtered by artist.

    Args:
        artist_id: If provided, only return albums by this artist.
    """
    data = await _gql(
        """
        query($artistId: Int) {
            albums(artistId: $artistId) {
                id title releaseYear artistId
                songs { id title trackNumber duration }
            }
        }
        """,
        {"artistId": artist_id},
    )
    return _fmt(data["albums"])


@mcp.tool()
async def create_album(
    title: str,
    artist_id: int,
    release_year: Optional[int] = None,
) -> str:
    """Add a new album for an existing artist.

    Args:
        title:        Album title.
        artist_id:    ID of the artist who released this album.
        release_year: Year the album was released.
    """
    data = await _gql(
        """
        mutation($input: AlbumInput!) {
            createAlbum(input: $input) { id title releaseYear artistId }
        }
        """,
        {"input": {"title": title, "artistId": artist_id, "releaseYear": release_year}},
    )
    return _fmt(data["createAlbum"])


@mcp.tool()
async def delete_album(id: int) -> str:
    """Delete an album and all its songs.

    Args:
        id: The album's numeric ID.
    """
    data = await _gql(
        "mutation($id: Int!) { deleteAlbum(id: $id) }",
        {"id": id},
    )
    ok = data["deleteAlbum"]
    return "Deleted." if ok else f"No album found with id={id}"


# ── Song tools ───────────────────────────────────────────────────────────────


@mcp.tool()
async def search_songs(album_id: Optional[int] = None, search: Optional[str] = None) -> str:
    """Search songs by title or list all songs in an album.

    Args:
        album_id: Limit results to a specific album.
        search:   Filter by song title (partial, case-insensitive).
    """
    data = await _gql(
        """
        query($albumId: Int, $search: String) {
            songs(albumId: $albumId, search: $search) {
                id title trackNumber duration albumId
            }
        }
        """,
        {"albumId": album_id, "search": search},
    )
    return _fmt(data["songs"])


@mcp.tool()
async def create_song(
    title: str,
    album_id: int,
    track_number: Optional[int] = None,
    duration: Optional[int] = None,
) -> str:
    """Add a new song to an existing album.

    Args:
        title:        Song title.
        album_id:     ID of the album this song belongs to.
        track_number: Position on the album (1-based).
        duration:     Duration in seconds.
    """
    data = await _gql(
        """
        mutation($input: SongInput!) {
            createSong(input: $input) { id title trackNumber duration albumId }
        }
        """,
        {"input": {"title": title, "albumId": album_id, "trackNumber": track_number, "duration": duration}},
    )
    return _fmt(data["createSong"])


@mcp.tool()
async def delete_song(id: int) -> str:
    """Delete a song.

    Args:
        id: The song's numeric ID.
    """
    data = await _gql(
        "mutation($id: Int!) { deleteSong(id: $id) }",
        {"id": id},
    )
    ok = data["deleteSong"]
    return "Deleted." if ok else f"No song found with id={id}"


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run(transport="stdio")
