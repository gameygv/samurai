# Tech Stack & Core Laws

- You are building a React application.
- Use TypeScript.
- Use React Router. KEEP the routes in src/App.tsx.
- ALWAYS try to use the shadcn/ui library.
- Tailwind CSS for all styling.

## 📜 PROJECT LAWS (NON-NEGOTIABLE)

1. **CONTEXTUAL LEARNING ONLY**: #CIA instructions MUST always be linked to a specific chat context. 
   - They are corrections or recommendations based on real interactions.
   - NEVER allow creating a #CIA rule from a generic "Add" button. They must be born in the `ChatViewer` / `MemoryPanel`.
   - The `LearningLog` (Bitácora) is for auditing, validating, and syncing existing reports only.

2. **HIERARCHY OF TRUTH**: 
   - Layer 1 (#CIA) overrides everything.
   - Layer 3 (Website Content) is the only source for technical data (prices, dates).

3. **COMPONENT STRUCTURE**:
   - Create a new file for every new component.
   - Aim for components under 100 lines.