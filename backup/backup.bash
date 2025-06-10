#!/bin/bash

temp=$(getopt -l 'pg-user:,container:,db-name:,out-dir:,help' -n 'backup.bash' -- "h" "$@")
eval set -- "$temp"
unset temp

usage="
pg_dump from a docker container.

options:
    -h,--help                             Print this information.
    --pg-user=<postgres user>             The user specified by PG_USER while building the server image. [ Default: postgres ]
    --container=<docker container name>   The name of the docker container running the Postgres server. [ Default: group-ironmen-tracker-postgres ]
    --db-name=<groupironman_db>           The database name specified by PG_DB while building the server image. [ Default: groupironman_db]
    --out-dir=<output directory>          Path to a directory to save the backup file into.
"

pg_user="postgres"
container="group-ironmen-tracker-postgres"
db_name="groupironman_db"
out_dir=""

while true; do
	case "$1" in
        '--pg-user')
            pg_user="$2"
            shift 2
            continue
        ;;
        '--container')
            container="$2"
            shift 2
            continue
        ;;
        '--db-name')
            db_name="$2"
            shift 2
            continue
        ;;
        '--out-dir')
            out_dir="$2"
            shift 2
            continue
        ;;
        '-h'|'--help')
            echo "$usage"
            exit
        ;;
        '--')
            shift
            break
        ;;
        *)
            # Unimplemented flag fallthrough
            echo 'Internal error!' >&2
            exit 1
        ;;
    esac
done

if [[ -z "$out_dir" ]]; then
    out_dir="~/backups/$container"
    echo "Using out-dir '$out_dir'."
fi

now=$(date +"%m_%d_%Y_%H_%M_%S")

out_dir=${out_dir/#\~/${HOME}}
if [ ! -d "$out_dir" ]; then
    echo "$out_dir does not exist, making now..."
    mkdir -p $out_dir
fi

if [ $? -ne 0 ]; then
    echo "Failed to create directory. Terminating..."
    exit 1
fi

out_dir=$(realpath "$out_dir")

output_file="$out_dir/backup_$now.gz"

docker exec "$container" pg_dump -U "$pg_user" --compress=6 "$db_name" > "$output_file"

if [ $? -ne 0 ]; then
    echo "Failed to make backup at '$output_file'. Terminating..."
    exit 1
fi

echo "Successfully made backup at '$output_file'"
