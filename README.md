# Group Ironmen Tracker Frontend and Backend

Forked from a repo at: [https://github.com/christoabrown/group-ironmen](https://github.com/christoabrown/group-ironmen)

The original repo is not being updated beyond maintenance, and there are features I wish to add, so I created this fork.

## Usage

Prerequisites

- Docker
- docker-compose

First, clone the repo. There are no prebuilt images hosted on DockerHub, as this repo is intended for self building and hosting, so you need the source code.

```bash
git clone https://github.com/BunniesRabbits/group-ironmen
```

Copy `.env.example`, renaming it to `.env`. Docker-compose will load these as environment variables while building and running. The main fields of interest are `HOST_PROTOCOL` and `HOST_URL`, which define the URL that gets constructed for requesting to the backend from the frontend.

### Example `.env`

When hosting the servers locally for testing, assuming host port `AAAA` is being forwarded to the backend container:

```text
HOST_PROTOCOL=http
HOST_URL=host.docker.internal:AAAA
... snipped ...
```

When deploying to a server, assuming you have a registered public domain forwarding to the required port on your server:

```text
HOST_PROTOCOL=https
HOST_URL=your.domain.here
... snipped ...
```

### Building and Running

Run docker-compose in the repo root:

```bash
cd /path/to/repo/group-ironmen
docker-compose up # optionally pass -d for detached mode
```

The containers should successfully be running. The frontend is served on port `4000` by default.

### Notes on Ports

Within their respective containers, the frontend listens for port `4000`, and the backend listens for port `8080`. `docker-compose.yml` is configured to set up a network that forwards `4000 -> 4000` and `5000 -> 8080`, so the host will be listening on `4000` and `5000`.

To change the host port being forwarded to each container from `AAAA` to `BBBB`, change these lines in `docker-compose.yml`:

```text
... snipped ...
ports:
    AAAA:XXXX
... snipped ...
```

to

```text
... snipped ...
ports:
    BBBB:XXXX
... snipped ...
```

## Maintenance

### Backups

Prerequisites

- docker
- pg_dump from PostgreSQL utilities

See `backup/backup.bash` for a script that can be run to backup the PostgreSQL database. The defaults in that script match the defaults in `.env.example`. The script is meant to be run on the host that is running the docker containers.

### Updating Cache

Prerequisites

- Apache Maven
- Git

The backend and frontend rely on assets that are pulled from a third-party archive. This includes item images, item data, collection log pages, etc. This needs to be done separately as OSRS is updated and new game caches are uploaded.

`./cache` contains an NPM project that handles this. With `./cache` as your working directory, run `npm run update` and the script will run. This script:

- Downloads the game cache
- Downloads Runelite
- Uses Runelite to dump the assets into friendly JSON/images
- Copies these assets to their required positions in `./server` and `./site`

Once this is done and the source tree is repopulated, you may start up the servers and they will load the new assets.
