#!/usr/bin/env python3
"""Optional independent SymPy checks for selected manually read 2025 Math-I problems.
No general exam grader, no OCR, no gold label or tutor-pedagogy judgment.
Run: python -m pip install 'sympy==1.14.0'
     python scripts/research/verify-kaoyan-2025-symbolic.py
"""
import json
from pathlib import Path
import sympy as S

def verify():
    items={}
    def check(number, actual, expected, scope):
        if S.simplify(actual-expected)!=0:
            raise AssertionError(f"Q{number}: {actual} != {expected}")
        items[str(number)]={"checkedScope":scope,"evidence":"symbolic_consistency",
                            "derived":str(S.simplify(actual))}
    x,a,b,rho=S.symbols("x a b rho",real=True)
    u=S.symbols("u",positive=True)
    # Near zero f''(0)>0 proves the f-minimum; analytic g with g'''(0)>0
    # and g''(0)=0 has an inflection at (0,0).
    t=S.symbols("t",real=True)
    fprime=S.exp(x*x)*S.sin(x)
    g=S.integrate(S.exp(t*t),(t,0,x))*S.sin(x)**2
    assert S.diff(fprime,x).subs(x,0)==1
    assert g.subs(x,0)==0 and S.diff(g,x,2).subs(x,0)==0
    check(1,S.diff(g,x,3).subs(x,0),6,
          "choice B: f''(0)=1, g(0)=g''(0)=0, analytic g'''(0)=6")
    q5=S.Matrix([[1,1,1],[1,0,0],[1,0,0]])
    check(5,sum(mult for eig,mult in q5.eigenvals().items() if eig.is_positive),
          S.Integer(1),"positive inertia index")
    sigma=S.Matrix([[1,rho],[rho,1]])
    check(8,S.Max(*sigma.eigenvals()).rewrite(S.Abs),1+S.Abs(rho),
          "covariance variance maximum, rho real and |rho|<1")
    check(9,S.exp(-2)*(1+2),3*S.exp(-2),"Poisson approximation with lambda=2")
    check(11,S.limit((x**x-1)/(S.log(x)*S.log(1-x)),x,0,dir="+"),-1,
          "one-sided limit")
    # Odd 2-periodic Fourier sine extension: -7/2 + 4 = 1/2;
    # Dirichlet limit at the interior jump is the average of one-sided limits.
    eps=S.symbols("eps",positive=True)
    piece=S.Piecewise((0,x<S.Rational(1,2)),(x*x,True))
    left=S.limit(piece.subs(x,S.Rational(1,2)-eps),eps,0,dir="+")
    right=S.limit(piece.subs(x,S.Rational(1,2)+eps),eps,0,dir="+")
    assert S.Rational(-7,2)+4==S.Rational(1,2)
    assert (left,right)==(0,S.Rational(1,4))
    check(12,(left+right)/2,S.Rational(1,8),
          "sine-series Dirichlet jump average after 2-periodic extension")
    X,Y,Z=S.symbols("X Y Z",real=True)
    f=X*Y**2*Z**3
    unit=S.Matrix([2,2,-1])/3
    check(13,S.Matrix([S.diff(f,v) for v in (X,Y,Z)]).subs(
          {X:1,Y:1,Z:1}).dot(unit),1,"directional derivative; unit vector")
    y=1-x*x
    check(14,S.integrate(y+S.cos(x)+(2*x+S.cos(y))*(-2*x),(x,1,-1)),
          S.Rational(4,3)-2*S.sin(1),"oriented line integral")
    q15=S.Matrix([[4,2,-3],[a,3,-4],[b,5,-7]])
    check(15,S.factor(q15.det()),-a+b-4,"determinant necessary condition only")
    witness=q15.subs({a:5,b:9})
    assert witness.rank()==2 and (witness*witness).rank()==1
    # The determinant alone does not suffice: under b=a+4, the characteristic
    # polynomial is t*(t^2+a-5). A repeated zero root forces a=5; at a=5,
    # rank(A)=2 > rank(A^2)=1, establishing the necessary and sufficient case.
    det_zero=q15.subs(b,a+4)
    characteristic=S.factor(det_zero.charpoly(S.Symbol("t")).as_expr())
    tau=S.Symbol("t")
    assert S.expand(characteristic-tau*(tau*tau+a-5))==0
    unique=det_zero.subs(a,5)
    assert unique.rank()==2 and (unique*unique).rank()==1
    # Counterexample to the shortcut 'det=0 implies kernels differ'.
    other=det_zero.subs(a,0)
    assert other.det()==0 and other.rank()==(other*other).rank()
    p=S.symbols("p",real=True)
    roots=[v for v in S.solve(3*p-2*p*p-S.Rational(5,8),p)
           if 0<=v<=S.Rational(1,2)]
    assert roots==[S.Rational(1,4)]
    check(16,(3*roots[0]-4*roots[0]**2)/S.Rational(5,8),
          S.Rational(4,5),"independent event probability and feasible root")
    check(17,S.integrate(1/((x+1)*(x*x-2*x+2)),(x,0,1)),
          (3*S.log(2)+S.pi)/10,"complete definite integral")
    F=S.Rational(1,2)*S.log(u)**2+2*S.log(u)+1
    check(18,u*u*S.diff(F,u,2)+u*S.diff(F,u),1,
          "transformed ODE only, with both initial conditions")
    assert S.simplify(F.subs(u,1)-1)==0
    assert S.simplify(S.diff(F,u).subs(u,1)-2)==0
    height=1/S.sqrt(3)
    radius2=2*height**2
    cone_volume=S.Rational(1,3)*S.pi*radius2*height
    cap_flux=(4/S.sqrt(3))*S.pi*radius2
    check(20,3*cone_volume-cap_flux,-2*S.sqrt(3)*S.pi/3,
          "cone side-flux; source worked final is contradicted")
    assert S.simplify(3*cone_volume-cap_flux-(S.sqrt(2)*S.pi/4-1))!=0
    A=S.Matrix([[0,-1,2],[-1,0,2],[-1,-1,a]])
    t=S.symbols("t")
    possible=S.solve(S.diff(A.charpoly(t).as_expr(),t).subs(t,1),a)
    assert possible==[3]
    check(21,possible[0],3,"repeated eigenvalue parameter and valid counterexample")
    A=A.subs(a,3)
    alpha=S.Matrix([0,0,1]); beta=S.Matrix([2,2,2])
    assert A*alpha==alpha+beta and A*A*alpha==alpha+2*beta
    assert alpha[0]==0 and alpha[1]==0
    loss=S.symbols("loss",nonnegative=True)
    density=2*100**2/(100+loss)**3
    prob=S.integrate(density,(loss,100,S.oo))
    mean=S.integrate((loss-100)*density,(loss,100,S.oo))
    check(22,prob,S.Rational(1,4),
          "P(Y>0), E(Y)=50 and Poisson thinning rate=2")
    assert S.simplify(mean-50)==0 and 8*prob==2
    return {"status":"research-only-independent-symbolic-consistency",
            "scope":"Manually transcribed subclaims only; source PDF is not official-gold authenticated",
            "sympyVersion":S.__version__,"checkedQuestionCount":len(items),
            "items":items}
def verify_inventory(result):
    """Fail closed if the evidence ledger disagrees with executed symbolic checks."""
    path=Path(__file__).resolve().parents[2]/"fixtures/research/kaoyan-math1-2025-all-questions-review-v0.1.json"
    ledger=json.loads(path.read_text(encoding="utf-8"))
    assert ledger["id"]=="kaoyan-math1-2025-all-questions-review-v0.1"
    all_items=ledger["items"]
    assert len(all_items)==22 and [i["question"] for i in all_items]==list(range(1,23))
    assert all(i["verifiedAsOfficialKey"] is False for i in all_items)
    expected={str(i["question"]) for i in all_items if i["independentlyChecked"]}
    actual=set(result["items"])
    assert len(expected)==15 and expected==actual, (sorted(expected), sorted(actual))
    assert result["checkedQuestionCount"]==len(actual)
    return result

if __name__=="__main__":
    print(json.dumps(verify_inventory(verify()),ensure_ascii=False,indent=2))
