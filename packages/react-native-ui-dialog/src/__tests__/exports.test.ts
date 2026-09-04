import {Dialog, DialogContent, DialogRoot} from '../index';

describe('dialog exports', () => {
  it('exposes composable and named APIs', () => {
    expect(Dialog.Root).toBe(DialogRoot);
    expect(Dialog.Content).toBe(DialogContent);
    expect(Dialog.Trigger).toBeDefined();
    expect(Dialog.Close).toBeDefined();
  });
});
