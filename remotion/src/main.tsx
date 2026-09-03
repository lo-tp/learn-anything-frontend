import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Content from './Content';
import Slider from './Slider';

const App: React.FC = () => {
  const [count, setCount] = useState(0); // start with no bullets

  return (
    <>
      <Content count={count} />
      <Slider value={count} onChange={setCount} />
    </>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
