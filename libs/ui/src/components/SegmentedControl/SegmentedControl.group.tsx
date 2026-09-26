import { Children, type ReactElement, type ReactNode, isValidElement } from 'react';

import { cn } from '../../functions';

import { SegmentedControl } from './SegmentedControl';

import type {
  SegmentedControlGroupProps,
  SegmentedControlProps,
} from './SegmentedControl.types';


function isSegmentChild(
  child: ReactNode,
): child is ReactElement<SegmentedControlProps> {
  return !!child && isValidElement(child) && child.type === SegmentedControl;
}

/**
 * Clones its `SegmentedControl` children with the active flag and the change
 * handler, so a caller declares the options and never wires selection by hand.
 */
export function SegmentedControlGroup({
  children,
  className,
  value,
  onValueChange,
  disabled,
}: SegmentedControlGroupProps) {
  const segments = Children.toArray(children).filter(isSegmentChild);

  function handleChange(itemValue: string) {
    onValueChange?.(itemValue);
  }

  return (
    <div
      role="group"
      className={cn(
        'flex h-9 items-center gap-1 rounded-12 bg-weak p-1',
        className,
      )}
    >
      {segments.map((child, index) => (
        <SegmentedControl
          key={index}
          {...child.props}
          disabled={disabled || child.props.disabled}
          isActive={child.props.value === value}
          onChange={handleChange}
        />
      ))}
    </div>
  );
}
