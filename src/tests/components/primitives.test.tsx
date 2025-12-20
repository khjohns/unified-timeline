/**
 * Functional tests for Primitive Components
 *
 * Tests component behavior, props, state changes, and user interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/primitives/Input';
import { Textarea } from '@/components/primitives/Textarea';
import { Checkbox } from '@/components/primitives/Checkbox';
import { FormField } from '@/components/primitives/FormField';
import { RadioGroup, RadioItem } from '@/components/primitives/RadioGroup';
import { DatePicker } from '@/components/primitives/DatePicker';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/primitives/Select';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Label } from '@/components/primitives/Label';

describe('Primitive Components - Functional Tests', () => {
  describe('Input', () => {
    it('should render with default props', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('should accept and display typed text', async () => {
      const user = userEvent.setup();
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');

      await user.type(input, 'Hello World');
      expect(input).toHaveValue('Hello World');
    });

    it('should call onChange when typing', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      render(<Input data-testid="input" onChange={handleChange} />);

      await user.type(screen.getByTestId('input'), 'a');
      expect(handleChange).toHaveBeenCalled();
    });

    it('should apply error styles when error prop is true', () => {
      render(<Input data-testid="input" error />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not have error styles when error prop is false', () => {
      render(<Input data-testid="input" error={false} />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Input data-testid="input" disabled />);
      expect(screen.getByTestId('input')).toBeDisabled();
    });

    it('should apply fullWidth class when fullWidth prop is true', () => {
      render(<Input data-testid="input" fullWidth />);
      expect(screen.getByTestId('input')).toHaveClass('w-full');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });

    it('should accept placeholder text', () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('should accept different input types', () => {
      render(<Input data-testid="input" type="email" />);
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email');
    });

    it('should merge custom className with default classes', () => {
      render(<Input data-testid="input" className="custom-class" />);
      expect(screen.getByTestId('input')).toHaveClass('custom-class');
    });
  });

  describe('Textarea', () => {
    it('should render with default props', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should accept and display typed text', async () => {
      const user = userEvent.setup();
      render(<Textarea data-testid="textarea" />);

      await user.type(screen.getByTestId('textarea'), 'Multi\nline\ntext');
      expect(screen.getByTestId('textarea')).toHaveValue('Multi\nline\ntext');
    });

    it('should have default rows of 4', () => {
      render(<Textarea data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '4');
    });

    it('should accept custom rows prop', () => {
      render(<Textarea data-testid="textarea" rows={6} />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('rows', '6');
    });

    it('should apply error styles when error prop is true', () => {
      render(<Textarea data-testid="textarea" error />);
      expect(screen.getByTestId('textarea')).toHaveAttribute('aria-invalid', 'true');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Textarea data-testid="textarea" disabled />);
      expect(screen.getByTestId('textarea')).toBeDisabled();
    });

    it('should apply fullWidth class when fullWidth prop is true', () => {
      render(<Textarea data-testid="textarea" fullWidth />);
      expect(screen.getByTestId('textarea')).toHaveClass('w-full');
    });
  });

  describe('Checkbox', () => {
    it('should render without label', () => {
      render(<Checkbox data-testid="checkbox" />);
      expect(screen.getByTestId('checkbox')).toBeInTheDocument();
    });

    it('should render with label', () => {
      render(<Checkbox label="Accept terms" id="terms" />);
      expect(screen.getByText('Accept terms')).toBeInTheDocument();
    });

    it('should toggle checked state on click', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<Checkbox data-testid="checkbox" onCheckedChange={handleChange} />);

      await user.click(screen.getByTestId('checkbox'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('should start checked when defaultChecked is true', () => {
      render(<Checkbox data-testid="checkbox" defaultChecked />);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'checked');
    });

    it('should be controllable with checked prop', () => {
      const { rerender } = render(<Checkbox data-testid="checkbox" checked={false} />);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'unchecked');

      rerender(<Checkbox data-testid="checkbox" checked={true} />);
      expect(screen.getByTestId('checkbox')).toHaveAttribute('data-state', 'checked');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Checkbox data-testid="checkbox" disabled />);
      expect(screen.getByTestId('checkbox')).toBeDisabled();
    });

    it('should have error styling when error prop is true', () => {
      render(<Checkbox data-testid="checkbox" error />);
      expect(screen.getByTestId('checkbox')).toHaveClass('border-pkt-border-red');
    });
  });

  describe('FormField', () => {
    it('should render children', () => {
      render(
        <FormField>
          <input data-testid="child-input" />
        </FormField>
      );
      expect(screen.getByTestId('child-input')).toBeInTheDocument();
    });

    it('should render label when provided', () => {
      render(
        <FormField label="Username">
          <input />
        </FormField>
      );
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('should show required indicator when required is true', () => {
      render(
        <FormField label="Email" required>
          <input />
        </FormField>
      );
      expect(screen.getByLabelText('påkrevd')).toBeInTheDocument();
    });

    it('should render error message when error is provided', () => {
      render(
        <FormField label="Password" error="Password is required">
          <input />
        </FormField>
      );
      expect(screen.getByText('Password is required')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Password is required');
    });

    it('should not render error message when error is not provided', () => {
      render(
        <FormField label="Password">
          <input />
        </FormField>
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should render help text when provided', () => {
      render(
        <FormField label="Password" helpText="Minimum 8 characters">
          <input />
        </FormField>
      );
      expect(screen.getByText('Minimum 8 characters')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(
        <FormField className="custom-class">
          <input />
        </FormField>
      );
      const fieldContainer = screen.getByRole('textbox').parentElement;
      expect(fieldContainer).toHaveClass('custom-class');
    });
  });

  describe('RadioGroup and RadioItem', () => {
    it('should render radio group with items', () => {
      render(
        <RadioGroup>
          <RadioItem value="option1" data-testid="radio1" />
          <RadioItem value="option2" data-testid="radio2" />
        </RadioGroup>
      );

      expect(screen.getByTestId('radio1')).toBeInTheDocument();
      expect(screen.getByTestId('radio2')).toBeInTheDocument();
    });

    it('should select an item when clicked', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <RadioGroup onValueChange={handleChange}>
          <RadioItem value="option1" data-testid="radio1" />
          <RadioItem value="option2" data-testid="radio2" />
        </RadioGroup>
      );

      await user.click(screen.getByTestId('radio1'));
      expect(handleChange).toHaveBeenCalledWith('option1');
    });

    it('should render labels when provided', () => {
      render(
        <RadioGroup>
          <RadioItem value="option1" label="Option 1" id="opt1" />
          <RadioItem value="option2" label="Option 2" id="opt2" />
        </RadioGroup>
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('should have controlled value', () => {
      const { rerender } = render(
        <RadioGroup value="option1">
          <RadioItem value="option1" data-testid="radio1" />
          <RadioItem value="option2" data-testid="radio2" />
        </RadioGroup>
      );

      expect(screen.getByTestId('radio1')).toHaveAttribute('data-state', 'checked');
      expect(screen.getByTestId('radio2')).toHaveAttribute('data-state', 'unchecked');

      rerender(
        <RadioGroup value="option2">
          <RadioItem value="option1" data-testid="radio1" />
          <RadioItem value="option2" data-testid="radio2" />
        </RadioGroup>
      );

      expect(screen.getByTestId('radio1')).toHaveAttribute('data-state', 'unchecked');
      expect(screen.getByTestId('radio2')).toHaveAttribute('data-state', 'checked');
    });

    it('should disable items when disabled', () => {
      render(
        <RadioGroup disabled>
          <RadioItem value="option1" data-testid="radio1" />
        </RadioGroup>
      );

      expect(screen.getByTestId('radio1')).toBeDisabled();
    });

    it('should show error styling when error prop is true', () => {
      render(
        <RadioGroup>
          <RadioItem value="option1" data-testid="radio1" error />
        </RadioGroup>
      );

      expect(screen.getByTestId('radio1')).toHaveClass('border-pkt-border-red');
    });
  });

  describe('Select', () => {
    it('should render with placeholder', () => {
      render(
        <Select>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('trigger')).toBeInTheDocument();
      expect(screen.getByText('Select an option')).toBeInTheDocument();
    });

    it('should display selected value when defaultValue is set', () => {
      render(
        <Select defaultValue="option1">
          <SelectTrigger data-testid="trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <Select disabled>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('trigger')).toBeDisabled();
    });

    it('should show error styling when error prop is true', () => {
      render(
        <Select>
          <SelectTrigger data-testid="trigger" error>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      expect(screen.getByTestId('trigger')).toHaveClass('border-pkt-border-red');
    });

    it('should render SelectTrigger with chevron icon', () => {
      render(
        <Select>
          <SelectTrigger data-testid="trigger">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
          </SelectContent>
        </Select>
      );

      // SelectTrigger includes a chevron icon
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toBeInTheDocument();
      expect(trigger.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('DatePicker', () => {
    it('should render with placeholder', () => {
      render(<DatePicker placeholder="Select a date" />);
      expect(screen.getByText('Select a date')).toBeInTheDocument();
    });

    it('should render with default placeholder when none provided', () => {
      render(<DatePicker />);
      expect(screen.getByText('Velg dato')).toBeInTheDocument();
    });

    it('should display formatted date when value is provided', () => {
      render(<DatePicker value="2025-01-15" />);
      expect(screen.getByText('15.01.2025')).toBeInTheDocument();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<DatePicker disabled />);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should apply fullWidth style when fullWidth prop is true', () => {
      render(<DatePicker fullWidth />);
      expect(screen.getByRole('button')).toHaveClass('w-full');
    });

    it('should show error styling when error prop is true', () => {
      render(<DatePicker error />);
      expect(screen.getByRole('button')).toHaveClass('border-pkt-border-red');
    });

    it('should have calendar icon', () => {
      render(<DatePicker />);
      const button = screen.getByRole('button');
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('should accept name and id props', () => {
      render(<DatePicker name="test-date" id="test-date-id" />);
      // Hidden input should have these props
      const hiddenInput = document.querySelector('input[type="hidden"]');
      expect(hiddenInput).toHaveAttribute('name', 'test-date');
      expect(hiddenInput).toHaveAttribute('id', 'test-date-id');
    });
  });

  describe('Button', () => {
    it('should render with children text', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<Button onClick={handleClick}>Click</Button>);
      await user.click(screen.getByText('Click'));

      expect(handleClick).toHaveBeenCalled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByText('Disabled')).toBeDisabled();
    });

    it('should not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      await user.click(screen.getByText('Disabled'));

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should render different variants', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByText('Primary')).toBeInTheDocument();

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByText('Secondary')).toBeInTheDocument();

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByText('Ghost')).toBeInTheDocument();

      rerender(<Button variant="danger">Danger</Button>);
      expect(screen.getByText('Danger')).toBeInTheDocument();
    });

    it('should render different sizes', () => {
      const { rerender } = render(<Button size="sm">Small</Button>);
      expect(screen.getByText('Small')).toBeInTheDocument();

      rerender(<Button size="md">Medium</Button>);
      expect(screen.getByText('Medium')).toBeInTheDocument();

      rerender(<Button size="lg">Large</Button>);
      expect(screen.getByText('Large')).toBeInTheDocument();
    });

    it('should accept type="submit"', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByText('Submit')).toHaveAttribute('type', 'submit');
    });

    it('should merge custom className with default classes', () => {
      render(<Button className="custom-class">Custom</Button>);
      expect(screen.getByText('Custom')).toHaveClass('custom-class');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Button</Button>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Card', () => {
    it('should render children', () => {
      render(
        <Card>
          <p>Card content</p>
        </Card>
      );
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('should render different variants', () => {
      const { rerender, container } = render(<Card variant="default">Default</Card>);
      expect(container.firstChild).toBeInTheDocument();

      rerender(<Card variant="elevated">Elevated</Card>);
      expect(screen.getByText('Elevated')).toBeInTheDocument();

      rerender(<Card variant="outlined">Outlined</Card>);
      expect(screen.getByText('Outlined')).toBeInTheDocument();
    });

    it('should apply custom className to the card element', () => {
      render(<Card className="custom-card" data-testid="card">Content</Card>);
      // className is applied to the card div itself, not parent
      expect(screen.getByTestId('card')).toHaveClass('custom-card');
    });

    it('should apply padding', () => {
      const { container } = render(<Card padding="lg">Padded</Card>);
      expect(container.firstChild).toBeInTheDocument();
      expect(container.firstChild).toHaveClass('p-10');
    });

    it('should forward ref correctly', () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Card</Card>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Label', () => {
    it('should render with text', () => {
      render(<Label>Label Text</Label>);
      expect(screen.getByText('Label Text')).toBeInTheDocument();
    });

    it('should be associated with input via htmlFor', () => {
      render(
        <>
          <Label htmlFor="test-input">Input Label</Label>
          <input id="test-input" />
        </>
      );

      const label = screen.getByText('Input Label');
      expect(label).toHaveAttribute('for', 'test-input');
    });

    it('should apply custom className', () => {
      render(<Label className="custom-label">Label</Label>);
      expect(screen.getByText('Label')).toHaveClass('custom-label');
    });
  });
});
