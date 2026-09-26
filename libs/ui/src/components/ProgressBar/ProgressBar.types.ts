export type ProgressSegment = {
  /** 0–100. Segments are laid out in order along the reading direction. */
  value: number;
  className: string;
  label?: string;
};

export type ProgressBarProps = {
  segments: ProgressSegment[];
  className?: string;
}
