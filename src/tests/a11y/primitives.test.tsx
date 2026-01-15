import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { expectNoA11yViolations } from '../../../__tests__/axeHelper';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Modal } from '@/components/primitives/Modal';
import { Tooltip } from '@/components/primitives/Tooltip';
import { AlertDialog } from '@/components/primitives/AlertDialog';

describe('Primitive Components - Accessibility', () => {
  describe('Button', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <div>
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="danger">Danger Button</Button>
        </div>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should be keyboard accessible', async () => {
      const { container } = render(
        <Button onClick={() => {}}>Clickable Button</Button>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should handle disabled state correctly', async () => {
      const { container } = render(
        <Button disabled>Disabled Button</Button>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('Card', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <div>
          <Card variant="default">
            <h2>Card Title</h2>
            <p>Card content goes here</p>
          </Card>
          <Card variant="elevated">
            <h2>Elevated Card</h2>
            <p>Card content goes here</p>
          </Card>
          <Card variant="outlined">
            <h2>Outlined Card</h2>
            <p>Card content goes here</p>
          </Card>
        </div>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('Modal', () => {
    it('should have no accessibility violations when open', async () => {
      const { container } = render(
        <Modal
          open={true}
          onOpenChange={() => {}}
          title="Test Modal"
          description="This is a test modal"
        >
          <div>
            <p>Modal content</p>
            <button type="button">Action Button</button>
          </div>
        </Modal>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have proper ARIA attributes', async () => {
      const { container } = render(
        <Modal
          open={true}
          onOpenChange={() => {}}
          title="Accessible Modal"
          description="Modal description"
        >
          <form>
            <label htmlFor="test-input">Test Input</label>
            <input id="test-input" type="text" />
          </form>
        </Modal>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('Tooltip', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <Tooltip content="Helpful tooltip text">
          <button type="button">Hover me</button>
        </Tooltip>
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });

  describe('AlertDialog', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <AlertDialog
          open={true}
          onOpenChange={() => {}}
          title="Confirm Action"
          description="Are you sure you want to proceed?"
          onConfirm={() => {}}
          confirmLabel="Yes, proceed"
          cancelLabel="Cancel"
        />
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });

    it('should have proper role for alert dialog', async () => {
      const { container } = render(
        <AlertDialog
          open={true}
          onOpenChange={() => {}}
          title="Warning"
          description="This action cannot be undone."
          onConfirm={() => {}}
        />
      );
      const results = await axe(container);
      expectNoA11yViolations(results);
    });
  });
});
