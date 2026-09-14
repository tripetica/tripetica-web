export function shouldDismissFloatingPopoverOnOutsidePress(input: {
  dismissOnOutsidePress: boolean;
  targetInsideLayer: boolean;
  targetInsideAnchor: boolean;
  targetExempt: boolean;
}) {
  if (!input.dismissOnOutsidePress) {
    return false;
  }
  if (input.targetInsideLayer || input.targetInsideAnchor || input.targetExempt) {
    return false;
  }
  return true;
}
