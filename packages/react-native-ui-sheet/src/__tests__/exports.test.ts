import {BottomSheetModal, SelectionBottomSheet} from '../index';

describe('sheet exports', () => {
  it('exposes base and selection sheets', () => {
    expect(typeof BottomSheetModal).toBe('function');
    expect(typeof SelectionBottomSheet).toBe('function');
  });
});
