/**
 * Reusable Button component matching the app's design system.
 *
 * Variants: 'primary' (gold), 'secondary' (outline), 'ghost' (transparent),
 *           'danger' (red), 'green' (client accent)
 * Sizes:    'sm', 'md', 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) {
  const cls = `btn btn-${variant} btn-${size} ${loading ? 'btn-loading' : ''} ${className}`.trim();

  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading && <span className="spinner spinner-sm" />}
      {children}
    </button>
  );
}
