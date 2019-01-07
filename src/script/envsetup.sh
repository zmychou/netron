#!/bin/bash

python_lib_path=$1
graph=$2
venv_path=$3

if [ -n $venv_path ]
then
    echo "Setup virtual environment $venv_path" > script.log
    source $venv_path
else 
    echo "Virtual environment didn't supply" > script.log
fi

export PYTHONPATH=$PYTHONPATH:$python_lib_path
echo $PYTHONPAT
echo `pwd`
#/home/chou/Work/Netron4SNPE/src/script/snpe-tensorflow-to-dlc-for-netron --graph $graph
./src/script/snpe-tensorflow-to-dlc-for-netron --graph $graph


