import subprocess
subprocess.run(['bash','/solution/solve.sh'],check=True)
subprocess.run(['chmod','-R','a+rX','/app'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
subprocess.run(['bash','/tests/app-lifecycle.sh','start'],check=True)
try:
    subprocess.run(['node','/results/browser-variants.cjs'],check=True,timeout=90)
finally:
    subprocess.run(['bash','/tests/app-lifecycle.sh','stop'],check=True)
