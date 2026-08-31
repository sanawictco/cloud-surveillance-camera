import { MonotonicTimestampAllocator } from '../monotonicTimestamp';

describe('MonotonicTimestampAllocator', () => {
  it('keeps the requested timestamp when it is after the previous one', () => {
    const allocator = new MonotonicTimestampAllocator();
    expect(allocator.next('table', 1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it('advances a same-millisecond request by one millisecond', () => {
    const allocator = new MonotonicTimestampAllocator();
    const first = allocator.next('table', 1_700_000_000_000);
    const second = allocator.next('table', 1_700_000_000_000);
    expect(first).toBe(1_700_000_000_000);
    expect(second).toBe(1_700_000_000_001);
  });

  it('advances past a regressed request clock instead of moving backwards', () => {
    const allocator = new MonotonicTimestampAllocator();
    allocator.next('table', 1_700_000_000_005);
    expect(allocator.next('table', 1_700_000_000_000)).toBe(1_700_000_000_006);
  });

  it('allocates independently per child table', () => {
    const allocator = new MonotonicTimestampAllocator();
    allocator.next('table-a', 1_700_000_000_000);
    expect(allocator.next('table-b', 1_700_000_000_000)).toBe(
      1_700_000_000_000,
    );
  });
});
