
import pybobyqa
import numpy as np
def objective(x):
    return (x[0] - 1)**2 + (x[1] - 2)**2
x0 = np.array([0.0, 0.0])
soln = pybobyqa.solve(objective, x0, maxfun=100)
print(soln.x)

