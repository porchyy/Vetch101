# 05: Split UI by post type: video view vs photo view

**What to build:** After auto-inspect resolves, the result card renders one of two views based on `post_type`. Video posts get the existing card restyled with a prominent primary download button and collapsible "ตัวเลือกเพิ่มเติม" for resolution picker, MP3, and folder. Photo posts get an image-strip preview with count/order, PNG/JPG format toggle, and a "ดาวน์โหลดรูป" primary button. Both views: loading/error states, keyboard-accessible focus rings.

**Blocked by:** Ticket 1 (data model), Ticket 2 (auto-inspect)

**Status:** done

- [x] `VideoResultCard` component: thumbnail, title, prominent DL button, collapsible extras
- [x] `PhotoResultCard` component: image strip, count, PNG/JPG toggle, DL button
- [x] Selecting `photo_post` as result type shows `PhotoResultCard`, otherwise `VideoResultCard`
- [x] Image format preference stored in localStorage
- [x] Keyboard nav: tab order, visible focus rings on all interactive elements
