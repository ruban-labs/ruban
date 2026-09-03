import {
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  RadioGroup,
  RadioGroupItem,
  Select,
  Textarea,
} from '../index';

describe('form exports', () => {
  it('exposes the complete form family', () => {
    for (const component of [
      Checkbox,
      Field,
      FieldDescription,
      FieldError,
      FieldLabel,
      Input,
      RadioGroup,
      RadioGroupItem,
      Select,
      Textarea,
    ]) {
      expect(component).toBeDefined();
    }
  });
});
