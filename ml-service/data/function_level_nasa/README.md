# NASA PROMISE Software Defect Benchmark Datasets

These datasets are part of the **NASA Metrics Data Program (MDP)** and the **PROMISE Software Engineering Repository**.
They provide empirical ground-truth measurements of software complexity and post-release defects across mission-critical systems.

## Datasets Summary

| Dataset | Description | Modules | Defective | Defect Rate | Features |
|---|---|---|---|---|---|
| **JM1** | jm1.csv | 10,885 | 2,106 | 19.3% | 21 |
| **KC1** | kc1.csv | 2,109 | 326 | 15.5% | 21 |
| **KC2** | kc2.csv | 522 | 107 | 20.5% | 21 |
| **PC1** | pc1.csv | 1,109 | 77 | 6.9% | 21 |

## Metric Descriptions
- `loc`: Lines of Code
- `v(g)`: McCabe Cyclomatic Complexity ($M = E - N + 2P$)
- `ev(g)`: Essential Complexity
- `iv(g)`: Design Complexity
- `n`: Halstead Total Operators + Operands
- `v`: Halstead Volume
- `d`: Halstead Difficulty
- `e`: Halstead Mental Effort
- `defective`: Ground-truth binary defect label (`0` = Clean, `1` = Defective)
