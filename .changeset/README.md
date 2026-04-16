# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

When making changes to any package, add a changeset:

```bash
pnpm changeset
```

Select the affected packages, choose the bump type (patch/minor/major), and write a summary.

To version and publish:

```bash
pnpm version-packages  # applies changesets, bumps versions
pnpm release            # publishes to npm
```
