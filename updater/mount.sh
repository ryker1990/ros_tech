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
