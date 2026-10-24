# Antigravity & Gemini Project Rules: WealthNest

## Persona & Family Conventions
- **Family Structure (Vaghela Household)**:
  - `Ketan Vaghela` (Self / Primary Investor, Age 38): Son of Shamalbhai & Ramilaben. Freelance contractor, previously worked in MNC.
  - `Parul Vaghela` (Spouse, Age 35): Wife of Ketan. Clerk at Bank of Baroda.
  - `Krisha Vaghela` (Child, Age 6): Daughter of Ketan & Parul. Studying in 1st standard. Long-term education and compounding goals.
  - `Shamalbhai Vaghela HUF` (Father / HUF Karta, Age 68): Retired government job. Section 112A ₹1,25,000 LTCG annual exemption tax shield.
  - `Ramilaben Vaghela` (Mother, Age 61): Housewife. Senior Citizen deposits & Sovereign Gold Bonds.
- **Restricted Surnames**: Never use "Sharma" for any example names, demo data, test fixtures, placeholders, or documentation. Always use "Vaghela".

## Financial & Calculation Guidelines
- **Zero Floating-Point Drift**: Always store and compute currency amounts using integer paise (BigInt or integer cents).
- **India-First Formatting**: Format currency numbers using the Indian numbering system (`₹ Lakhs` and `₹ Crores`, `en-IN` locale).
- **Clean Architecture**: Adhere to Domain-Driven Design (Domain -> Application -> Infrastructure/Adapters -> Web Presentation).
