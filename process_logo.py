import sys
from PIL import Image, ImageDraw

def create_rounded_logo(input_path, output_png_path, output_ico_path):
    # Open the image
    img = Image.open(input_path).convert("RGBA")
    
    # We want to crop a bit of the border if needed, but let's just make the outer part transparent based on a rounded rectangle mask
    # Actually, the user's image has a slight grey background at the very corners.
    # We can create a mask to just keep the rounded part.
    
    w, h = img.size
    # Assuming it's a square. Let's create a rounded rectangle mask.
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    
    # The radius of the corners. Looking at the image, it's about 15-20% of the width. Let's say 15%.
    r = int(w * 0.15)
    
    # Draw rounded rectangle
    draw.rounded_rectangle((0, 0, w, h), radius=r, fill=255)
    
    # Apply mask
    rounded_img = Image.new('RGBA', (w, h))
    rounded_img.paste(img, (0,0), mask=mask)
    
    # Save as PNG
    rounded_img.save(output_png_path, "PNG")
    
    # Save as ICO
    # Resize for ICO typically (256x256 max)
    icon_size = (256, 256)
    ico_img = rounded_img.resize(icon_size, Image.Resampling.LANCZOS)
    ico_img.save(output_ico_path, format="ICO", sizes=[(256, 256)])
    
    print("Logo processed successfully.")

if __name__ == "__main__":
    create_rounded_logo(sys.argv[1], sys.argv[2], sys.argv[3])
