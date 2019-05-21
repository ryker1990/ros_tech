#!/bin/sh

if [ ! -d "./mount" ]; then
    mkdir ./mount
fi

# unmount to start with
umount ./mount

# mount the Pi's directory to a local one
sshfs "pi@raspberrypi:/home/pi/" ./mount

if [ ! -d "./mount/rosin" ]; then
  mkdir ./mount/rosin
  mkdir ./mount/rosin/frontend
  mkdir ./mount/rosin/backend
  mkdir ./mount/rosin/backend/build
  mkdir ./mount/rosin/updater
fi

# listen to changes and copy files to the mounted directory
alias rsync_b='rsync -azP --delete local/backend/build/* mount/rosin/backend/build'
alias rsync_b_json='rsync -azP --delete local/backend/package.json mount/rosin/backend/package.json'
alias rsync_f='rsync -azP --delete local/frontend/build/* mount/rosin/frontend'
alias rsync_u='rsync -azP --delete local/updater/* mount/rosin/updater'

rsync_b;
rsync_b_json;
rsync_f;
rsync_u;
fswatch -o ./local/ |
while read f;
do
  rsync_b;
  rsync_b_json;
  rsync_f;
  rsync_u;
done

