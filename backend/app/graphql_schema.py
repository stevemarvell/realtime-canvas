from __future__ import annotations

from typing import List, Optional

import strawberry
from sqlalchemy.orm import Session
from strawberry.fastapi import BaseContext
from strawberry.types import Info

from . import models


# ── GraphQL output types ────────────────────────────────────────────────────


@strawberry.type
class SongType:
    id: int
    title: str
    duration: Optional[int]
    track_number: Optional[int]
    album_id: int

    @staticmethod
    def from_orm(song: models.Song) -> "SongType":
        return SongType(
            id=song.id,
            title=song.title,
            duration=song.duration,
            track_number=song.track_number,
            album_id=song.album_id,
        )


@strawberry.type
class AlbumType:
    id: int
    title: str
    release_year: Optional[int]
    artist_id: int

    @strawberry.field
    def songs(self, info: Info) -> List[SongType]:
        db: Session = info.context.db
        rows = db.query(models.Song).filter(models.Song.album_id == self.id).order_by(models.Song.track_number).all()
        return [SongType.from_orm(s) for s in rows]

    @staticmethod
    def from_orm(album: models.Album) -> "AlbumType":
        return AlbumType(
            id=album.id,
            title=album.title,
            release_year=album.release_year,
            artist_id=album.artist_id,
        )


@strawberry.type
class ArtistType:
    id: int
    name: str
    bio: Optional[str]
    genre: Optional[str]
    formed_year: Optional[int]

    @strawberry.field
    def albums(self, info: Info) -> List[AlbumType]:
        db: Session = info.context.db
        rows = db.query(models.Album).filter(models.Album.artist_id == self.id).all()
        return [AlbumType.from_orm(a) for a in rows]

    @staticmethod
    def from_orm(artist: models.Artist) -> "ArtistType":
        return ArtistType(
            id=artist.id,
            name=artist.name,
            bio=artist.bio,
            genre=artist.genre,
            formed_year=artist.formed_year,
        )


# ── Input types ─────────────────────────────────────────────────────────────


@strawberry.input
class ArtistInput:
    name: str
    bio: Optional[str] = None
    genre: Optional[str] = None
    formed_year: Optional[int] = None


@strawberry.input
class AlbumInput:
    title: str
    artist_id: int
    release_year: Optional[int] = None


@strawberry.input
class SongInput:
    title: str
    album_id: int
    duration: Optional[int] = None
    track_number: Optional[int] = None


# ── Context ──────────────────────────────────────────────────────────────────


class GraphQLContext(BaseContext):
    def __init__(self, db: Session):
        self.db = db


# ── Queries ──────────────────────────────────────────────────────────────────


@strawberry.type
class Query:
    @strawberry.field(description="List artists, optionally filtered by genre or name.")
    def artists(
        self,
        info: Info,
        genre: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[ArtistType]:
        db: Session = info.context.db
        q = db.query(models.Artist)
        if genre:
            q = q.filter(models.Artist.genre.ilike(f"%{genre}%"))
        if search:
            q = q.filter(models.Artist.name.ilike(f"%{search}%"))
        return [ArtistType.from_orm(a) for a in q.order_by(models.Artist.name).all()]

    @strawberry.field(description="Get a single artist by ID.")
    def artist(self, info: Info, id: int) -> Optional[ArtistType]:
        db: Session = info.context.db
        row = db.query(models.Artist).filter(models.Artist.id == id).first()
        return ArtistType.from_orm(row) if row else None

    @strawberry.field(description="List albums, optionally filtered by artist.")
    def albums(self, info: Info, artist_id: Optional[int] = None) -> List[AlbumType]:
        db: Session = info.context.db
        q = db.query(models.Album)
        if artist_id:
            q = q.filter(models.Album.artist_id == artist_id)
        return [AlbumType.from_orm(a) for a in q.order_by(models.Album.release_year).all()]

    @strawberry.field(description="Get a single album by ID.")
    def album(self, info: Info, id: int) -> Optional[AlbumType]:
        db: Session = info.context.db
        row = db.query(models.Album).filter(models.Album.id == id).first()
        return AlbumType.from_orm(row) if row else None

    @strawberry.field(description="List songs, optionally filtered by album or title search.")
    def songs(
        self,
        info: Info,
        album_id: Optional[int] = None,
        search: Optional[str] = None,
    ) -> List[SongType]:
        db: Session = info.context.db
        q = db.query(models.Song)
        if album_id:
            q = q.filter(models.Song.album_id == album_id)
        if search:
            q = q.filter(models.Song.title.ilike(f"%{search}%"))
        return [SongType.from_orm(s) for s in q.order_by(models.Song.album_id, models.Song.track_number).all()]


# ── Mutations ────────────────────────────────────────────────────────────────


@strawberry.type
class Mutation:
    @strawberry.mutation(description="Add a new artist.")
    def create_artist(self, info: Info, input: ArtistInput) -> ArtistType:
        db: Session = info.context.db
        artist = models.Artist(
            name=input.name,
            bio=input.bio,
            genre=input.genre,
            formed_year=input.formed_year,
        )
        db.add(artist)
        db.commit()
        db.refresh(artist)
        return ArtistType.from_orm(artist)

    @strawberry.mutation(description="Add a new album for an artist.")
    def create_album(self, info: Info, input: AlbumInput) -> AlbumType:
        db: Session = info.context.db
        album = models.Album(
            title=input.title,
            artist_id=input.artist_id,
            release_year=input.release_year,
        )
        db.add(album)
        db.commit()
        db.refresh(album)
        return AlbumType.from_orm(album)

    @strawberry.mutation(description="Add a new song to an album.")
    def create_song(self, info: Info, input: SongInput) -> SongType:
        db: Session = info.context.db
        song = models.Song(
            title=input.title,
            album_id=input.album_id,
            duration=input.duration,
            track_number=input.track_number,
        )
        db.add(song)
        db.commit()
        db.refresh(song)
        return SongType.from_orm(song)

    @strawberry.mutation(description="Delete an artist and all their albums and songs.")
    def delete_artist(self, info: Info, id: int) -> bool:
        db: Session = info.context.db
        row = db.query(models.Artist).filter(models.Artist.id == id).first()
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True

    @strawberry.mutation(description="Delete an album and all its songs.")
    def delete_album(self, info: Info, id: int) -> bool:
        db: Session = info.context.db
        row = db.query(models.Album).filter(models.Album.id == id).first()
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True

    @strawberry.mutation(description="Delete a song.")
    def delete_song(self, info: Info, id: int) -> bool:
        db: Session = info.context.db
        row = db.query(models.Song).filter(models.Song.id == id).first()
        if not row:
            return False
        db.delete(row)
        db.commit()
        return True


# ── Schema ───────────────────────────────────────────────────────────────────

schema = strawberry.Schema(query=Query, mutation=Mutation)
