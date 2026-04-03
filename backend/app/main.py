from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy.orm import Session
from strawberry.fastapi import GraphQLRouter

from .database import Base, SessionLocal, engine, get_db
from .graphql_schema import GraphQLContext, schema


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


async def get_graphql_context(db: Session = Depends(get_db)) -> GraphQLContext:
    return GraphQLContext(db=db)


graphql_app = GraphQLRouter(
    schema,
    context_getter=get_graphql_context,
)

app = FastAPI(
    title="Music API",
    description="Artists, albums, and songs — queried via GraphQL.",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(graphql_app, prefix="/graphql")


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
