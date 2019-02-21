SET python_lib_path=%1
SET graph=%2
SET venv_path=%3

IF EXIST %venv_path% (
    echo "Setup virtual environment $venv_path" 
    %venv_path%
) else ( 
    echo "Virtual environment didn't supply" 
)

SETX PYTHONPATH %python_lib_path%
echo %PYTHONPAT%
.\src\script\snpe-tensorflow-to-dlc-for-netron --graph $graph
