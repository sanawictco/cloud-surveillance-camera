#!/bin/sh
set -eu

for file_var in $(env | grep -o '^[A-Za-z_][A-Za-z0-9_]*_FILE=' | sed 's/=$//' || true); do
  target_var="${file_var%_FILE}"
  file_path="$(printenv "$file_var" || true)"
  [ -n "$file_path" ] || continue
  if [ ! -r "$file_path" ]; then
    echo "entrypoint: ${file_var} points to an unreadable file: ${file_path}" >&2
    exit 1
  fi
  secret_value="$(cat "$file_path")"
  export "${target_var}=${secret_value}"
  unset "${file_var}"
done

exec "$@"
