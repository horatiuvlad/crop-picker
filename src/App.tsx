import { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";
import { useSpring, animated } from "react-spring";
import { useDrag } from "@use-gesture/react";

function AppDeprecated() {
  const [isAnimationEnabled, setIsAnimationEnabled] = useState<boolean>(true);

  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }));

  // Set the drag hook and define component movement based on gesture data
  const bind = useDrag(
    (handler) => {
      const {
        down,
        movement: [mx, my],
      } = handler;
      // console.log({ handler });
      api.start({ x: down ? mx : 0, y: down ? my : 0, immediate: down });
    },
    { delay: 250 }
  );

  const [styles, testApi] = useSpring(() => ({
    from: { opacity: 0, x: -50 },
    to: { opacity: 1, x: 50 },
    config: { duration: 1000 },
    loop: { reverse: true },
  }));

  useEffect(() => {
    if (isAnimationEnabled) {
      testApi.resume();
    } else {
      testApi.pause();
    }
  }, [testApi, isAnimationEnabled]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <animated.div style={styles}>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn React
          </a>
        </animated.div>

        <div onClick={() => setIsAnimationEnabled(!isAnimationEnabled)}>
          toggle animation
        </div>

        <animated.div
          {...bind()}
          style={{ x, y, width: 100, height: 100, backgroundColor: "red" }}
        />
      </header>
    </div>
  );
}

function App() {
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }));

  // Set the drag hook and define component movement based on gesture data
  const bind = useDrag(
    (handler) => {
      const {
        down,
        movement: [mx, my],
      } = handler;
      // console.log({ handler });
      api.start({ x: down ? mx : 0, y: down ? my : 0, immediate: down });
    },
    { delay: 250 }
  );

  return (
    <div
      className="App"
      style={{ minHeight: "100vh", display: "flex" }}
      {...bind()}
    >
      <animated.div
        style={{
          x,
          y,
          backgroundColor: "red",
          ...helperStyles.absoluteFill,
          zIndex: 1,
        }}
      />

      <div
        style={{
          backgroundColor: "blue",
          opacity: 0.5,
          ...helperStyles.absoluteFill,
          zIndex: 2,
        }}
      />

      <div
        style={{
          ...helperStyles.absoluteFill,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 3,
        }}
      >
        <div style={{ backgroundColor: "green", width: 100, height: 100 }} />
      </div>
    </div>
  );
}

const helperStyles = {
  absoluteFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
} as const;

export default App;
