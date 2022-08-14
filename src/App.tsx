import "./App.css";
import { useSpring, animated } from "react-spring";
import { useDrag } from "@use-gesture/react";
import { imageUri } from "./imageUri";
import { Image } from "./Image";
import { ISize, XY } from "./struct";

const imageSize: ISize = { width: 1920, height: 1080 };

const onMove = (position: XY<number>) => {
  console.log({ position });
};

function App() {
  const [{ x, y }, api] = useSpring<{ x: number; y: number }>(() => ({
    x: 0,
    y: 0,
  }));

  // Set the drag hook and define component movement based on gesture data
  const bind = useDrag(
    ({ down, offset: [x, y] }) => {
      api.start({
        x,
        y,
        immediate: down,
      });

      if (down === false) {
        onMove({ x, y });
      }
    },
    { delay: 250, bounds: { left: -100, right: 100, top: -100, bottom: 100 } }
  );

  return (
    <div
      className="App"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
      }}
      {...bind()}
    >
      {/* Background Image (animated) */}
      <animated.div
        style={{
          x,
          y,
          backgroundColor: "red",
          zIndex: 1,
          width: imageSize.width,
          height: imageSize.height,
        }}
      >
        <Image source={imageUri} size={{ width: 1920, height: 1080 }} />
      </animated.div>

      {/* Background Image Overlay (opacity) */}
      <div
        style={{
          backgroundColor: "blue",
          opacity: 0.5,
          ...helperStyles.absoluteFill,
          zIndex: 2,
        }}
      />

      {/* Foreground Image Container */}
      <div
        style={{
          ...helperStyles.absoluteFill,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 3,
        }}
      >
        <div
          style={{
            overflow: "hidden",
            width: 100,
            height: 100,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Foreground Image (animated) */}
          <Image
            source={imageUri}
            size={{ width: 1920, height: 1080 }}
            // style={{ transform: "translate(50px, 100px)" }}
          />
        </div>
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
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
} as const;

export default App;
