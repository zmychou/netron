#!/bin/bash

venv_path=$1
python_lib_path=$2
graph=$3

if [ -n $venv_path ]
then
    echo "Setup virtual environment $venv_path"
    source $venv_path
else 
    echo "Virtual environment didn't supply"
fi

export PYTHONPATH=$PYTHONPATH:$python_lib_path
echo $PYTHONPAT
echo `pwd`
/home/chou/Work/Netron4SNPE/src/script/snpe-tensorflow-to-dlc-for-netron --graph $graph


