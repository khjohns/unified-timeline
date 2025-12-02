import { useState } from 'react';
import { Button, Card, Modal, Tooltip, AlertDialog } from '../components/primitives';

/**
 * Component Showcase Page
 *
 * This page demonstrates all primitive components and their variants.
 * Used for testing and verification during Phase 2 implementation.
 */
export function ComponentShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-oslo-blue mb-2">
            Primitive Components Showcase
          </h1>
          <p className="text-gray-600">
            Testing all primitive components from Phase 2 implementation
          </p>
        </header>

        {/* Buttons Section */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-2xl font-bold text-oslo-blue mb-4">Buttons</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="danger">Danger Button</Button>
                <Button variant="primary" disabled>
                  Disabled Button
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Cards Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-oslo-blue">Cards</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="default" padding="md">
              <h3 className="font-bold text-oslo-blue mb-2">Default Card</h3>
              <p className="text-gray-600">
                This is a default card with medium padding.
              </p>
            </Card>

            <Card variant="elevated" padding="md">
              <h3 className="font-bold text-oslo-blue mb-2">Elevated Card</h3>
              <p className="text-gray-600">
                This card has a shadow for elevation effect.
              </p>
            </Card>

            <Card variant="outlined" padding="md">
              <h3 className="font-bold text-oslo-blue mb-2">Outlined Card</h3>
              <p className="text-gray-600">
                This card has a border outline.
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="elevated" padding="sm">
              <h3 className="font-bold text-oslo-blue mb-2">Small Padding</h3>
              <p className="text-gray-600">Compact spacing</p>
            </Card>

            <Card variant="elevated" padding="md">
              <h3 className="font-bold text-oslo-blue mb-2">Medium Padding</h3>
              <p className="text-gray-600">Default spacing</p>
            </Card>

            <Card variant="elevated" padding="lg">
              <h3 className="font-bold text-oslo-blue mb-2">Large Padding</h3>
              <p className="text-gray-600">Generous spacing</p>
            </Card>
          </div>
        </div>

        {/* Modal Section */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-2xl font-bold text-oslo-blue mb-4">Modal</h2>
          <p className="text-gray-600 mb-4">
            Test focus trap, keyboard navigation (Tab, Escape), and accessibility.
          </p>
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>

          <Modal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title="Example Modal"
            description="This is a modal dialog demonstrating Radix Dialog wrapper with Oslo design."
            size="md"
          >
            <div className="space-y-4">
              <p className="text-gray-700">
                This modal demonstrates:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-600">
                <li>Focus trap (try pressing Tab)</li>
                <li>Keyboard navigation (Escape to close)</li>
                <li>Backdrop click to close</li>
                <li>Smooth animations</li>
                <li>Proper z-index layering</li>
              </ul>

              <div className="flex gap-3 pt-4">
                <Button variant="primary">Confirm</Button>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>
        </Card>

        {/* Tooltip Section */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-2xl font-bold text-oslo-blue mb-4">Tooltips</h2>
          <p className="text-gray-600 mb-4">
            Hover over buttons to see tooltips in different positions.
          </p>

          <div className="flex flex-wrap gap-4">
            <Tooltip content="This tooltip appears on top" side="top">
              <Button variant="secondary">Hover (Top)</Button>
            </Tooltip>

            <Tooltip content="This tooltip appears on the right" side="right">
              <Button variant="secondary">Hover (Right)</Button>
            </Tooltip>

            <Tooltip content="This tooltip appears on bottom" side="bottom">
              <Button variant="secondary">Hover (Bottom)</Button>
            </Tooltip>

            <Tooltip content="This tooltip appears on the left" side="left">
              <Button variant="secondary">Hover (Left)</Button>
            </Tooltip>
          </div>
        </Card>

        {/* AlertDialog Section */}
        <Card variant="elevated" padding="lg">
          <h2 className="text-2xl font-bold text-oslo-blue mb-4">Alert Dialog</h2>
          <p className="text-gray-600 mb-4">
            Confirmation dialogs for critical actions.
          </p>
          <Button variant="danger" onClick={() => setAlertOpen(true)}>
            Delete Item
          </Button>

          <AlertDialog
            open={alertOpen}
            onOpenChange={setAlertOpen}
            title="Are you sure?"
            description="This action cannot be undone. This will permanently delete the item."
            confirmLabel="Delete"
            cancelLabel="Cancel"
            variant="danger"
            onConfirm={() => {
              console.log('Item deleted');
            }}
          />
        </Card>

        {/* Accessibility Checklist */}
        <Card variant="outlined" padding="lg">
          <h2 className="text-2xl font-bold text-oslo-blue mb-4">
            Accessibility Checklist
          </h2>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-success-500">✓</span>
              <span>Modal traps focus and returns focus on close</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success-500">✓</span>
              <span>All buttons have visible focus indicators</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success-500">✓</span>
              <span>Escape key closes modals and dialogs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success-500">✓</span>
              <span>All interactive elements are keyboard accessible</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success-500">✓</span>
              <span>Color contrast meets WCAG AA standards</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
