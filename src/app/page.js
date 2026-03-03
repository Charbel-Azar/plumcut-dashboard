"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LOGIN_BEANS = [
  { file: "LP-Beans-Back-B 10.svg", x: "12%", y: "22%", size: "clamp(140px, 16vw, 300px)", opacity: 0.4 },
  { file: "LP-Beans-Back-B 11.svg", x: "26%", y: "62%", size: "clamp(150px, 18vw, 320px)", opacity: 0.45 },
  { file: "LP-Beans-Back-B 12.svg", x: "46%", y: "18%", size: "clamp(160px, 18vw, 340px)", opacity: 0.5 },
  { file: "LP-Beans-Back-B 13.svg", x: "64%", y: "36%", size: "clamp(150px, 17vw, 320px)", opacity: 0.45 },
  { file: "LP-Beans-Back-B 14.svg", x: "82%", y: "20%", size: "clamp(140px, 16vw, 300px)", opacity: 0.4 },
  { file: "LP-Beans-Front-B 01.svg", x: "18%", y: "40%", size: "clamp(170px, 19vw, 360px)", opacity: 0.55 },
  { file: "LP-Beans-Front-B 02.svg", x: "34%", y: "30%", size: "clamp(160px, 18vw, 340px)", opacity: 0.55 },
  { file: "LP-Beans-Front-B 03.svg", x: "52%", y: "52%", size: "clamp(170px, 20vw, 380px)", opacity: 0.6 },
  { file: "LP-Beans-Front-B 04.svg", x: "74%", y: "62%", size: "clamp(170px, 19vw, 360px)", opacity: 0.6 },
  { file: "LP-Beans-Middle-B 05.svg", x: "10%", y: "72%", size: "clamp(160px, 18vw, 340px)", opacity: 0.5 },
  { file: "LP-Beans-Middle-B 06.svg", x: "30%", y: "82%", size: "clamp(150px, 17vw, 320px)", opacity: 0.5 },
  { file: "LP-Beans-Middle-B 07.svg", x: "50%", y: "74%", size: "clamp(160px, 18vw, 340px)", opacity: 0.55 },
  { file: "LP-Beans-Middle-B 08.svg", x: "68%", y: "82%", size: "clamp(150px, 17vw, 320px)", opacity: 0.5 },
  { file: "LP-Beans-Middle-B 09.svg", x: "90%", y: "74%", size: "clamp(140px, 16vw, 300px)", opacity: 0.45 },
];

export default function Home() {
  const router = useRouter();
  const pageRef = useRef(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const page = pageRef.current;
    if (!page) {
      return undefined;
    }

    const layers = Array.from(page.querySelectorAll("[data-parallax-layer]"));
    if (!layers.length) {
      return undefined;
    }

    const layerMeta = new Map();

    layers.forEach((layer) => {
      const bean = layer.closest(".login-bean");
      const speed = 8 + Math.random() * 16;
      const angle = Math.random() * Math.PI * 2;
      const driftX = 8 + Math.random() * 18;
      const driftY = 8 + Math.random() * 18;
      const driftSpeed = 0.15 + Math.random() * 0.25;
      const driftPhase = Math.random() * Math.PI * 2;

      layer.dataset.speed = speed.toFixed(2);
      layer.dataset.angle = angle.toFixed(4);
      layerMeta.set(layer, { driftX, driftY, driftSpeed, driftPhase });

      if (bean) {
        const floatRange = 18 + Math.random() * 35;
        const floatAngle = Math.random() * Math.PI * 2;
        const floatX = Math.cos(floatAngle) * floatRange;
        const floatY = Math.sin(floatAngle) * floatRange;
        const floatDuration = `${(18 + Math.random() * 18).toFixed(2)}s`;
        const floatDelay = `${(-Math.random() * 12).toFixed(2)}s`;
        const rotate = `${(Math.random() * 6 - 3).toFixed(2)}deg`;
        const blur = `${(Math.random() * 8 + 3).toFixed(1)}px`;
        const spinDuration = `${(28 + Math.random() * 36).toFixed(2)}s`;
        const spinDirection = Math.random() > 0.5 ? "normal" : "reverse";

        bean.style.setProperty("--float-x", `${floatX}px`);
        bean.style.setProperty("--float-y", `${floatY}px`);
        bean.style.setProperty("--float-duration", floatDuration);
        bean.style.setProperty("--float-delay", floatDelay);
        bean.style.setProperty("--float-rotate", rotate);
        bean.style.setProperty("--bean-blur", blur);
        bean.style.setProperty("--spin-duration", spinDuration);
        bean.style.setProperty("--spin-direction", spinDirection);
      }
    });

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationFrameId = 0;

    const update = (time) => {
      const t = time * 0.001;
      layers.forEach((layer) => {
        const meta = layerMeta.get(layer);
        const speed = Number.parseFloat(layer.dataset.speed || "10");
        const angle = Number.parseFloat(layer.dataset.angle || "0");
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = currentX * cos - currentY * sin;
        const rotatedY = currentX * sin + currentY * cos;
        const driftT = t * meta.driftSpeed + meta.driftPhase;
        const driftLayerX = Math.sin(driftT) * meta.driftX;
        const driftLayerY = Math.cos(driftT * 0.9 + meta.driftPhase) * meta.driftY;
        const layerX = rotatedX * speed + driftLayerX;
        const layerY = rotatedY * speed + driftLayerY;

        layer.style.setProperty("--bean-parallax-x", `${layerX}px`);
        layer.style.setProperty("--bean-parallax-y", `${layerY}px`);
      });
    };

    const tick = (time) => {
      const ease = 0.04;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      update(time);
      animationFrameId = window.requestAnimationFrame(tick);
    };

    const handleMove = (event) => {
      const rect = page.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width - 0.5;
      const relY = (event.clientY - rect.top) / rect.height - 0.5;
      const mouseScale = 0.6;
      targetX = relX * mouseScale;
      targetY = relY * mouseScale;
    };

    const reset = () => {
      targetX = 0;
      targetY = 0;
    };

    page.addEventListener("pointermove", handleMove);
    page.addEventListener("pointerleave", reset);
    page.addEventListener("pointercancel", reset);
    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      page.removeEventListener("pointermove", handleMove);
      page.removeEventListener("pointerleave", reset);
      page.removeEventListener("pointercancel", reset);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Invalid credentials");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (response.status === 401) {
        setError("Invalid credentials");
        return;
      }

      if (!response.ok) {
        throw new Error(`Login failed (${response.status})`);
      }

      const payload = await response.json();
      const reviewerName = String(payload?.reviewerName || "")
        .trim()
        .toLowerCase();

      if (!reviewerName) {
        throw new Error("Login payload did not include reviewerName");
      }

      localStorage.setItem("reviewerName", reviewerName);
      if (payload?.name) {
        localStorage.setItem("reviewerDisplayName", String(payload.name));
      }

      router.push("/chats");
    } catch (submitError) {
      console.error("[dashboard] login failed:", submitError?.message || submitError);
      setError("Invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page login-page--hero" ref={pageRef}>
      <div className="login-hero-bg" aria-hidden="true">
        <img className="login-hero-bg-image" src="/images/login-hero/LP-BackGround.svg" alt="" />
        <div className="login-beans">
          {LOGIN_BEANS.map((bean) => (
            <div
              key={bean.file}
              className="login-bean"
              style={{
                left: bean.x,
                top: bean.y,
                width: bean.size,
              }}
            >
              <div className="login-bean-parallax" data-parallax-layer>
                <div className="login-bean-float">
                  <img src={`/images/login-hero/beans/${encodeURIComponent(bean.file)}`} alt="" style={{ opacity: bean.opacity }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="login-card">
        <h1 className="login-title">plumcut Dashboard Login</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Credentials"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
