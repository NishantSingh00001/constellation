import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page"><div className="wrap" style={{ paddingBlock: "100px" }}>
      <p className="eyebrow">404</p>
      <h1 className="h1">Lost in <span className="serif grad-text">space.</span></h1>
      <p className="lead">There's nothing at this address.</p>
      <div className="hero__cta"><Link className="btn" to="/">Go home</Link><Link className="btn btn--ghost" to="/run/demo">Open the demo</Link></div>
    </div></div>
  );
}
