"""
Seed the database with sample artists, albums, and songs.

Usage:
    cd backend
    python seed.py
"""

from app.database import Base, SessionLocal, engine
from app.models import Album, Artist, Song

Base.metadata.create_all(bind=engine)

SEED = [
    {
        "name": "Radiohead",
        "genre": "Alternative Rock",
        "formed_year": 1985,
        "bio": "British rock band from Abingdon, Oxfordshire.",
        "albums": [
            {
                "title": "OK Computer",
                "release_year": 1997,
                "songs": [
                    ("Airbag", 1, 277),
                    ("Paranoid Android", 2, 383),
                    ("Subterranean Homesick Alien", 3, 274),
                    ("Exit Music (For a Film)", 4, 245),
                    ("Let Down", 5, 299),
                    ("Karma Police", 6, 264),
                    ("Fitter Happier", 7, 116),
                    ("Electioneering", 8, 231),
                    ("Climbing Up the Walls", 9, 278),
                    ("No Surprises", 10, 228),
                    ("Lucky", 11, 259),
                    ("The Tourist", 12, 325),
                ],
            },
            {
                "title": "Kid A",
                "release_year": 2000,
                "songs": [
                    ("Everything in Its Right Place", 1, 261),
                    ("Kid A", 2, 274),
                    ("The National Anthem", 3, 366),
                    ("How to Disappear Completely", 4, 355),
                    ("Treefingers", 5, 228),
                    ("Optimistic", 6, 324),
                    ("In Limbo", 7, 213),
                    ("Idioteque", 8, 289),
                    ("Morning Bell", 9, 268),
                    ("Motion Picture Soundtrack", 10, 360),
                ],
            },
        ],
    },
    {
        "name": "Miles Davis",
        "genre": "Jazz",
        "formed_year": 1944,
        "bio": "American jazz musician, widely considered one of the most influential musicians of the 20th century.",
        "albums": [
            {
                "title": "Kind of Blue",
                "release_year": 1959,
                "songs": [
                    ("So What", 1, 562),
                    ("Freddie Freeloader", 2, 584),
                    ("Blue in Green", 3, 337),
                    ("All Blues", 4, 693),
                    ("Flamenco Sketches", 5, 566),
                ],
            },
            {
                "title": "Bitches Brew",
                "release_year": 1970,
                "songs": [
                    ("Pharaoh's Dance", 1, 1159),
                    ("Bitches Brew", 2, 1380),
                    ("Spanish Key", 3, 994),
                    ("John McLaughlin", 4, 228),
                    ("Miles Runs the Voodoo Down", 5, 874),
                    ("Sanctuary", 6, 771),
                ],
            },
        ],
    },
    {
        "name": "Kendrick Lamar",
        "genre": "Hip-Hop",
        "formed_year": 2003,
        "bio": "American rapper and songwriter from Compton, California.",
        "albums": [
            {
                "title": "good kid, m.A.A.d city",
                "release_year": 2012,
                "songs": [
                    ("Sherane a.k.a Master Splinter's Daughter", 1, 231),
                    ("Bitch, Don't Kill My Vibe", 2, 280),
                    ("Backseat Freestyle", 3, 214),
                    ("The Art of Peer Pressure", 4, 323),
                    ("Money Trees", 5, 387),
                    ("Poetic Justice", 6, 305),
                    ("good kid", 7, 248),
                    ("m.A.A.d city", 8, 341),
                    ("Swimming Pools (Drank)", 9, 312),
                    ("Sing About Me, I'm Dying of Thirst", 10, 727),
                    ("Real", 11, 434),
                    ("Compton", 12, 284),
                ],
            },
            {
                "title": "To Pimp a Butterfly",
                "release_year": 2015,
                "songs": [
                    ("Wesley's Theory", 1, 297),
                    ("For Free? (Interlude)", 2, 130),
                    ("King Kunta", 3, 234),
                    ("Institutionalized", 4, 263),
                    ("These Walls", 5, 311),
                    ("u", 6, 283),
                    ("Alright", 7, 219),
                    ("For Sale? (Interlude)", 8, 148),
                    ("Momma", 9, 280),
                    ("Hood Politics", 10, 262),
                    ("How Much a Dollar Cost", 11, 249),
                    ("Complexion (A Zulu Love)", 12, 292),
                    ("The Blacker the Berry", 13, 325),
                    ("You Ain't Gotta Lie (Momma Said)", 14, 220),
                    ("i", 15, 330),
                    ("Mortal Man", 16, 720),
                ],
            },
        ],
    },
]


def seed():
    db = SessionLocal()
    try:
        if db.query(Artist).count() > 0:
            print("Database already seeded, skipping.")
            return

        for artist_data in SEED:
            albums_data = artist_data.pop("albums")
            artist = Artist(**artist_data)
            db.add(artist)
            db.flush()

            for album_data in albums_data:
                songs_data = album_data.pop("songs")
                album = Album(artist_id=artist.id, **album_data)
                db.add(album)
                db.flush()

                for title, track_number, duration in songs_data:
                    song = Song(
                        title=title,
                        track_number=track_number,
                        duration=duration,
                        album_id=album.id,
                    )
                    db.add(song)

        db.commit()
        print(f"Seeded {len(SEED)} artists.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
