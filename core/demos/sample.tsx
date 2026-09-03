import { useState, useCallback, useEffect } from 'react';

// ---------- 幻灯片数据 ----------
const slides = [
  {
    id: 0,
    title: "Newton's Second Law",
    subtitle: "Force, Mass & Acceleration",
    body: (
      <div style={{ fontSize: '1.2rem', marginTop: '0.5em', opacity: 0.7 }}>
        <span>⚡</span> The fundamental law of motion
      </div>
    ),
  },
  {
    id: 1,
    title: "Force & Acceleration",
    subtitle: "What changes motion?",
    body: (
      <>
        <p style={{ marginBottom: '0.6em' }}>
          <strong style={{ color: '#f6d365' }}>Force</strong> – push or pull that changes motion.
        </p>
        <p style={{ marginBottom: '0.6em' }}>
          <strong style={{ color: '#f6d365' }}>Acceleration</strong> – how quickly velocity changes.
        </p>
        <div
          style={{
            background: 'rgba(255,215,100,0.12)',
            borderLeft: '4px solid #f6d365',
            padding: '16px 24px',
            borderRadius: '12px',
            marginTop: '16px',
            textAlign: 'left',
          }}
        >
          <div>🔹 More force → more acceleration</div>
          <div>🔹 More mass → less acceleration</div>
        </div>
      </>
    ),
  },
  {
    id: 2,
    title: "The Formula",
    subtitle: "F = m · a",
    body: (
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '4.5rem',
            fontWeight: '700',
            color: '#fff',
            textShadow: '0 0 30px rgba(246,211,101,0.3)',
            letterSpacing: '8px',
            margin: '20px 0',
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {['F', '=', 'm', '·', 'a'].map((char, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                animation: 'bounce 1.2s ease-in-out infinite alternate',
                animationDelay: `${i * 0.15}s`,
              }}
            >
              {char}
            </span>
          ))}
        </div>
        <div style={{ fontSize: '1.1rem', opacity: 0.8 }}>
          Force = mass × acceleration
        </div>
      </div>
    ),
  },
  {
    id: 3,
    title: "Real‑World Example",
    subtitle: "Pushing a Cart",
    body: (
      <div style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ fontSize: '2rem', textAlign: 'center' }}>🛒</div>
        <p style={{ margin: '12px 0' }}>
          <strong style={{ color: '#f6d365' }}>Same force</strong> on a lighter cart → 
          <span style={{ color: '#ffb3b3' }}> bigger acceleration</span>.
        </p>
        <p style={{ margin: '12px 0' }}>
          <strong style={{ color: '#f6d365' }}>Heavier cart</strong> needs 
          <span style={{ color: '#8fcbff' }}> more force</span> for same acceleration.
        </p>
        <div
          style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '20px',
            padding: '16px',
            marginTop: '16px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⚖️</span> F = m · a – always works!
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: "Summary",
    subtitle: "Key takeaway",
    body: (
      <ul style={{ listStyle: 'none', padding: 0, fontSize: '1.2rem', textAlign: 'left' }}>
        <li style={{ margin: '12px 0' }}>✅ Force causes acceleration.</li>
        <li style={{ margin: '12px 0' }}>✅ Mass resists acceleration.</li>
        <li style={{ margin: '12px 0' }}>✅ F = m · a is the bridge.</li>
        <li style={{ margin: '12px 0' }}>✅ Direction matters – it's a vector!</li>
      </ul>
    ),
  },
];

// ---------- 主组件 ----------
const Presentation = () => {
  const [current, setCurrent] = useState(0);
  const total = slides.length;

  const goTo = useCallback((index) => {
    if (index >= 0 && index < total) setCurrent(index);
  }, [total]);

  const goPrev = () => goTo(current - 1);
  const goNext = () => goTo(current + 1);

  // 键盘左右键支持
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [current, goPrev, goNext]);

  // ----- 内联样式对象（全部） -----
  const containerStyle = {
    width: '100%',
    maxWidth: '1000px',
    height: '90vh',
    maxHeight: '700px',
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)',
    borderRadius: '40px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.1)',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid rgba(255,255,255,0.08)',
    margin: '20px auto',
  };

  const trackStyle = {
    display: 'flex',
    width: `${total * 100}%`,
    height: '100%',
    transform: `translateX(-${current * (100 / total)}%)`,
    transition: 'transform 0.7s cubic-bezier(0.65, 0, 0.35, 1)',
    willChange: 'transform',
  };

  const slideStyle = {
    width: `${100 / total}%`,
    height: '100%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 50px',
    color: '#f0f4ff',
    boxSizing: 'border-box',
  };

  const cardStyle = (isActive) => ({
    width: '100%',
    height: '100%',
    background: 'rgba(20,25,55,0.65)',
    backdropFilter: 'blur(4px)',
    borderRadius: '30px',
    padding: '40px 45px',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 15px 35px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    transition: 'transform 0.3s ease, opacity 0.6s ease',
    transform: isActive ? 'scale(1)' : 'scale(0.98)',
    opacity: isActive ? 1 : 0.7,
  });

  const titleStyle = {
    fontSize: '3.2rem',
    fontWeight: '700',
    color: '#f6d365', // fallback
    // 用纯色替代渐变，因为内联不支持背景裁剪文字
    textShadow: '0 0 20px rgba(246,211,101,0.3)',
    marginBottom: '0.2em',
    letterSpacing: '-0.02em',
  };

  const subtitleStyle = {
    fontSize: '1.6rem',
    fontWeight: '300',
    color: '#b8c6ff',
    marginBottom: '0.6em',
  };

  const bodyStyle = {
    fontSize: '1.2rem',
    lineHeight: '1.7',
    maxWidth: '700px',
    color: '#d0daff',
  };

  // 导航栏样式
  const controlsStyle = {
    position: 'absolute',
    bottom: '30px',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '18px',
    zIndex: 10,
    pointerEvents: 'none', // 让点击穿透，但内部按钮可点击
  };

  const dotsStyle = {
    display: 'flex',
    gap: '12px',
    pointerEvents: 'auto',
  };

  const dotStyle = (active) => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: active ? '#f6d365' : 'rgba(255,255,255,0.2)',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    padding: 0,
    boxShadow: active ? '0 0 20px rgba(246,211,101,0.5)' : 'none',
    transform: active ? 'scale(1.2)' : 'scale(1)',
  });

  const arrowStyle = (disabled) => ({
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#fff',
    fontSize: '1.8rem',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    transition: 'all 0.2s ease',
    pointerEvents: 'auto',
    opacity: disabled ? 0.25 : 1,
  });

  // 悬停状态（箭头）
  const [hoverPrev, setHoverPrev] = useState(false);
  const [hoverNext, setHoverNext] = useState(false);

  const arrowHoverStyle = (disabled, hover) => ({
    ...arrowStyle(disabled),
    background: hover && !disabled ? 'rgba(246,211,101,0.25)' : arrowStyle(disabled).background,
    borderColor: hover && !disabled ? '#f6d365' : arrowStyle(disabled).borderColor,
    transform: hover && !disabled ? 'scale(1.05)' : 'scale(1)',
  });

  return (
    <div style={containerStyle}>
      <div style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <div style={trackStyle}>
          {slides.map((slide, index) => {
            const isActive = index === current;
            return (
              <div key={slide.id} style={slideStyle}>
                <div style={cardStyle(isActive)}>
                  <div style={titleStyle}>{slide.title}</div>
                  <div style={subtitleStyle}>{slide.subtitle}</div>
                  <div style={bodyStyle}>{slide.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 导航控件 */}
        <div style={controlsStyle}>
          <button
            style={arrowHoverStyle(current === 0, hoverPrev)}
            onClick={goPrev}
            disabled={current === 0}
            onMouseEnter={() => setHoverPrev(true)}
            onMouseLeave={() => setHoverPrev(false)}
          >
            ◀
          </button>

          <div style={dotsStyle}>
            {slides.map((_, i) => (
              <button
                key={i}
                style={dotStyle(i === current)}
                onClick={() => goTo(i)}
              />
            ))}
          </div>

          <button
            style={arrowHoverStyle(current === total - 1, hoverNext)}
            onClick={goNext}
            disabled={current === total - 1}
            onMouseEnter={() => setHoverNext(true)}
            onMouseLeave={() => setHoverNext(false)}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default Presentation;

