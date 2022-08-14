import { ISize } from "./struct";
import { CSSProperties } from "react";

interface IProps {
  source: string;
  size: ISize;
  style?: CSSProperties;
}

export const Image = ({ size, source, style }: IProps) => (
  <img
    style={style}
    alt=""
    src={source}
    width={size.width}
    height={size.height}
  />
);
