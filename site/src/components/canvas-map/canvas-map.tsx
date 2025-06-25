import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { Context2DScaledWrapper, type CoordinatePair } from "./canvas-wrapper";
import { CanvasMapRenderer, type LabelledCoordinates } from "./canvas-map-renderer";
import { useGroupStateContext } from "../../context/group-state-context";
import type { GroupState } from "../../data/api";

import "./canvas-map.css";

const memberCoordinatesSelector = (state: GroupState | undefined): LabelledCoordinates[] => {
  if (!state) return [];
  return [
    ...state.members
      .entries()
      .filter(([_, state]) => state.coordinates)
      .map(([name, state]) => ({ label: name, coords: state.coordinates! })),
  ];
};

export const useCanvasMap = ({
  interactive,
}: {
  interactive: boolean;
}): {
  coordinateIndicator: ReactElement;
  controls: ReactElement;
  backgroundMap: ReactElement;
} => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelRatioRef = useRef<number>(1);
  const [renderer, setRenderer] = useState<CanvasMapRenderer>();
  const [dragging, setDragging] = useState<boolean>();
  const [coordinates, setCoordinates] = useState<CoordinatePair>();
  const animationFrameHandleRef = useRef<number>(undefined);
  const memberCoordinates = useGroupStateContext(memberCoordinatesSelector);

  if (memberCoordinates) {
    renderer?.updatePlayerPositionsFromOSRSCoordinates(memberCoordinates);
  }

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const devicePixelRatio = window.devicePixelRatio;
    pixelRatioRef.current = devicePixelRatio;
    canvas.width = Math.max(canvas.offsetWidth * devicePixelRatio, 1);
    canvas.height = Math.max(canvas.offsetHeight * devicePixelRatio, 1);

    const context = new Context2DScaledWrapper({
      pixelRatio: pixelRatioRef.current,
      context: canvas.getContext("2d")!,
    });
    if (renderer) {
      renderer.forceRenderNextFrame = true;
      renderer.update(context);
    }
  }, [renderer]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return (): void => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas]);

  const render = useCallback((): void => {
    if (canvasRef.current === null) {
      console.error("No canvas.");
      return;
    }

    if (renderer === undefined) return;

    const context = new Context2DScaledWrapper({
      pixelRatio: pixelRatioRef.current,
      context: canvasRef.current.getContext("2d")!,
    });

    renderer.update(context);
    animationFrameHandleRef.current = window.requestAnimationFrame(() => {
      render();
    });
  }, [renderer]);

  useEffect(() => {
    console.info("Rebuilding renderer.");

    CanvasMapRenderer.load()
      .then((renderer) => {
        setRenderer(renderer);
      })
      .catch((reason) => {
        console.error("Failed to build renderer:", reason);
      });
  }, []);

  useEffect(() => {
    if (renderer === undefined) return;

    renderer.onCursorCoordinatesUpdate = setCoordinates;
    renderer.onDraggingUpdate = setDragging;

    return (): void => {
      renderer.onCursorCoordinatesUpdate = undefined;
      renderer.onDraggingUpdate = undefined;
    };
  }, [renderer]);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (animationFrameHandleRef.current) {
      window.cancelAnimationFrame(animationFrameHandleRef.current);
    }

    render();
  }, [render]);

  const handlePointerMove = useCallback(
    ({ clientX, clientY }: { clientX: number; clientY: number }) => {
      renderer?.handlePointerMove({ x: clientX, y: clientY });
    },
    [renderer],
  );
  const handlePointerUp = useCallback(() => {
    renderer?.handlePointerUp();
  }, [renderer]);
  const handlePointerDown = useCallback(() => {
    renderer?.handlePointerDown();
  }, [renderer]);
  const handlePointerLeave = useCallback(() => {
    renderer?.handlePointerLeave();
  }, [renderer]);
  const handleScroll = useCallback(
    ({ deltaY }: { deltaY: number }) => {
      renderer?.handleScroll(deltaY);
    },
    [renderer],
  );
  const handleSelectPlane = useCallback(
    (plane: number) => {
      renderer?.handlePlaneSelect(plane);
    },
    [renderer],
  );

  const coordinatesView = coordinates ? `X: ${coordinates.x}, Y: ${coordinates.y}` : undefined;
  const draggingClass = dragging ? "dragging" : "";
  const interactiveClass = interactive ? "interactive" : "";

  const planeSelect = (
    <div id="canvas-map-plane-select-container" className="rsborder-tiny rsbackground">
      <select
        id="canvas-map-plane-select"
        onChange={(e) => {
          handleSelectPlane(e.target.selectedIndex);
        }}
      >
        <option value="1">Plane: 1</option>
        <option value="2">Plane: 2</option>
        <option value="3">Plane: 3</option>
        <option value="4">Plane: 4</option>
      </select>
    </div>
  );
  const teleportButtons = (
    <>
      {memberCoordinates?.map(({ label, coords }) => {
        return (
          <button
            key={label}
            className="men-button"
            onClick={() => {
              if (!renderer) return;
              renderer.jumpToWorldPosition({
                coords,
              });
              renderer.forceRenderNextFrame = true;
            }}
          >
            {label}
            <br /> ({coords.x}, {coords.y}, {coords.plane})
          </button>
        );
      })}
    </>
  );
  const coordinateIndicator = <div id="canvas-map-coordinates">{coordinatesView}</div>;

  const backgroundMap = (
    <div id="canvas-map-container">
      <canvas
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleScroll}
        id="canvas-map"
        className={`${draggingClass} ${interactiveClass}`}
        ref={canvasRef}
      />
    </div>
  );
  const controls = (
    <div style={{ display: "flex" }}>
      {planeSelect}
      {teleportButtons}
    </div>
  );

  return { coordinateIndicator, controls, backgroundMap };
};
