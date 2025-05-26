# Group Ironmen Tracker Frontend and Backend

Forked from a repo at: [https://github.com/christoabrown/group-ironmen](https://github.com/christoabrown/group-ironmen)

The original repo is not being updated beyond maintenance, and there are features I wish to add, so I created this fork.

## Usage

Prerequisites

* Docker
* docker-compose

First, clone the repo. There are no prebuilt images hosted on DockerHub, as this repo is intended for self building and hosting, so you need the source code.

```
git clone https://github.com/BunniesRabbits/group-ironmen
```

Copy `.env.example`, renaming it to `.env`. Docker-compose will load these as environment variables while building and running. The main fields of interest are `HOST_PROTOCOL` and `HOST_URL`, which define the URL that gets constructed for requesting to the backend from the frontend.

### Example `.env`
When hosting the servers locally for testing, assuming host port `AAAA` is being forwarded to the container:
```
HOST_PROTOCOL=http
HOST_URL=host.docker.internal:AAAA
... snipped ...
```
When deploying to a server, assuming you have a registered public domain forwarding to the required port on your server:
```
HOST_PROTOCOL=https
HOST_URL=your.domain.here
... snipped ...
```

### Building and Running
Run docker-compose in the repo root:
```
cd /path/to/repo/group-ironmen
docker-compose up # optionally pass -d for detached mode
```

The containers should successfully be running. The frontend is served on port `4000` by default.

### Notes on Ports 
Within their respective containers, the frontend listens for port `4000`, and the backend listens for port `8080`. `docker-compose.yml` is configured to set up a network that forwards `4000 -> 4000` and `5000 -> 8080`, so the host will be listening on `4000` and `5000`.

To change the host port being forwarded to each container from `AAAA` to `BBBB`, change these lines in `docker-compose.yml`:
```
... snipped ...
ports:
    AAAA:XXXX
... snipped ...
```
to
```
... snipped ...
ports:
    BBBB:XXXX
... snipped ...
```