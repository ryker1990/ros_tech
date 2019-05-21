#!/bin/bash

# Check for prepared update and replace existing one:
if [ -d /home/pi/rosin_update ]; then
  echo "> Unzipped update available."
  mv /home/pi/rosin /home/pi/rosin_tmp
  mv /home/pi/rosin_update /home/pi/rosin
  rm -rf /home/pi/rosin_tmp

  sudo chown pi:pi -R /home/pi/rosin/
  sudo chmod -R 755 /home/pi/rosin/

  if [ -f /home/pi/rosin/post.sh ]; then
   echo "> Running post script."
   cd /home/pi/rosin/
   ./post.sh
  fi
  exit
fi

# Wait a while for the Wi-Fi to connect
sleep 30s

# Clear any unfinushed updates:
echo "> Cleaning update directory."
rm -rf /home/pi/rosin/updater/update

echo "> Creating update directories."
mkdir /home/pi/rosin/updater/update
mkdir /home/pi/rosin/updater/update/zip
mkdir /home/pi/rosin/updater/update/unzipped
echo "> Starting download."
wget http://rosintech.app/updates/1.0/pneumatic.zip -O /home/pi/rosin/updater/update/zip/update.zip

echo "> Downloaded file."

if [ ! -f /home/pi/rosin/updater/update/zip/update.zip ]; then
  echo "> File doesn't exist."
  exit
fi

echo "> File exists."

if ! unzip /home/pi/rosin/updater/update/zip/update.zip -d /home/pi/rosin/updater/update/unzipped/; then
  echo "> Can't unzip."
  exit
fi

echo "> Unzipped."

mkdir /home/pi/rosin_update
mv /home/pi/rosin/updater/update/unzipped/* /home/pi/rosin_update/
