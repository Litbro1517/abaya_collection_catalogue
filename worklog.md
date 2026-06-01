---
Task ID: 1
Agent: Main
Task: Fix carousel display issues for products with many images (10+)

Work Log:
- Investigated the CatalogPreview.tsx component to understand image group/variant handling
- Queried database to find actual data: products like "عباية بنت حوران" genuinely have 65 images in the groupe_images column
- The data is correct - the Google Sheet has 65 "groupe image N" columns that are grouped into one IMAGE_ARRAY
- Root cause of UI issues: ImageCarousel used aspectRatio 3/4 unconditionally, making carousel too tall in detail dialog
- With 55vh+ of carousel height + thumbnails + info + CTA, the dialog exceeded viewport height
- Images were cut off ("affichée à moitié") because the carousel overflow was hidden
- Only one scroll cursor because the dialog only had vertical scroll in the info section

Stage Summary:
- Added maxHeight and objectFit props to ImageCarousel component
- Detail dialog now uses maxHeight="55vh" and objectFit="contain" for proper image display
- Replaced limited thumbnail strip (max 10) with full scrollable strip showing all images
- Added auto-scroll to active thumbnail in the strip
- Extracted ProductDetailContent into separate component for proper React hooks usage
- Fixed zoom dialog image display with proper contain sizing
- Reduced spacing in detail dialog to fit more content in viewport
- Deployed to Vercel: https://abaya-collection-catalogue.vercel.app
