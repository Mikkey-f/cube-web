package com.cube.lab.util;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * 封面图落盘前的无损「降体积」处理。
 *
 * <p>背景：用户上传的封面常常是「像素不大、体积巨大」的 RGBA PNG（例如 430×430 却有 350KB），
 * 而页面里只显示在直径约 220px 的圆形里，白白浪费流量。
 *
 * <p>策略（**只改编码，不改构图**）：
 * <ul>
 *   <li>像素超过 {@link #MAX_EDGE}：等比缩到 640 以内（封面显示区域最大约 240px，640 已远超 2 倍屏需求）</li>
 *   <li>完全不透明 且 体积超过 {@link #SIZE_THRESHOLD}：转成 JPEG(q0.85)，这是省下大头的地方</li>
 *   <li>带透明通道：保持 PNG，不压（避免把背景压成白块导致显示变化）</li>
 *   <li>已经足够小 / 读不出来（例如 JDK 不支持的 webp）：原样返回 null，调用方按原文件保存</li>
 * </ul>
 * 处理结果只要不比原图小，也会返回 null，保证「绝不把文件变大」。
 */
public final class CoverImageProcessor {

    /** 封面最长边上限（显示区域约 220~240px，640 足够 2x/3x 屏） */
    public static final int MAX_EDGE = 640;
    /** 超过这个体积才考虑重编码（小于它就说明已经很经济） */
    public static final long SIZE_THRESHOLD = 200L * 1024;
    /** JPEG 质量：0.85 在 640px 尺寸下与原图肉眼无差 */
    private static final float JPEG_QUALITY = 0.85f;

    /** 处理结果：新的字节内容 + 应该使用的扩展名 */
    public record Result(byte[] data, String ext) {}

    private CoverImageProcessor() {
    }

    /**
     * 尝试压缩。返回 null 表示「不需要／不适合处理，按原样保存」。
     * 本方法不抛异常：任何失败都退化成分 null，绝不阻断上传。
     */
    public static Result process(byte[] raw) {
        if (raw == null || raw.length == 0) return null;
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(raw));
            if (src == null) {
                // JDK 默认读不了 webp 等格式 —— 原样保留，行为与改造前一致
                return null;
            }

            boolean opaque = isOpaque(src);
            boolean needResize = Math.max(src.getWidth(), src.getHeight()) > MAX_EDGE;
            boolean heavy = raw.length > SIZE_THRESHOLD;

            // 既不用缩放、又不该转码 → 不碰
            if (!needResize && (!opaque || !heavy)) return null;

            BufferedImage scaled = needResize ? scaleToFit(src) : src;

            byte[] data = opaque
                    ? encodeJpeg(flattenToRgb(scaled))
                    : encodePng(scaled);

            String ext = opaque ? "jpg" : "png";
            if (data.length >= raw.length) {
                // 压完反而更大（例如本来就是高压缩的 jpg）→ 放弃，保留原图
                return null;
            }
            return new Result(data, ext);
        } catch (Exception e) {
            return null;
        }
    }

    /** 是否完全不透明（逐像素抽检 alpha，有任意半透明/透明像素即视为需要保留 PNG） */
    private static boolean isOpaque(BufferedImage img) {
        if (!img.getColorModel().hasAlpha()) return true;
        int w = img.getWidth();
        int h = img.getHeight();
        // 抽检：每 4 个像素取一个，足够发现照片里的透明区域，又比全量扫描快得多
        for (int y = 0; y < h; y += 4) {
            for (int x = 0; x < w; x += 4) {
                int alpha = (img.getRGB(x, y) >>> 24) & 0xFF;
                if (alpha < 250) return false;
            }
        }
        return true;
    }

    /** 等比缩放到最长边不超过 MAX_EDGE（大比例缩小时逐步折半，比一步插值锐利） */
    private static BufferedImage scaleToFit(BufferedImage src) {
        int w = src.getWidth();
        int h = src.getHeight();
        double ratio = (double) MAX_EDGE / Math.max(w, h);
        int tw = Math.max(1, (int) Math.round(w * ratio));
        int th = Math.max(1, (int) Math.round(h * ratio));

        BufferedImage cur = src;
        int cw = w;
        int ch = h;
        while (cw / 2 >= tw && ch / 2 >= th) {
            cw /= 2;
            ch /= 2;
            cur = drawScaled(cur, cw, ch);
        }
        return (cw == tw && ch == th) ? cur : drawScaled(cur, tw, th);
    }

    private static BufferedImage drawScaled(BufferedImage src, int tw, int th) {
        BufferedImage out = new BufferedImage(tw, th, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(src, 0, 0, tw, th, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    /** 去掉 alpha 通道铺到白底：封面在页面上是圆形裁剪，四角本来就不显示 */
    private static BufferedImage flattenToRgb(BufferedImage src) {
        int w = src.getWidth();
        int h = src.getHeight();
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, w, h);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(src, 0, 0, null);
        } finally {
            g.dispose();
        }
        return out;
    }

    private static byte[] encodeJpeg(BufferedImage img) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) throw new IOException("no jpeg writer");
        ImageWriter writer = writers.next();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(bos)) {
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(JPEG_QUALITY);
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return bos.toByteArray();
    }

    private static byte[] encodePng(BufferedImage img) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", bos);
        return bos.toByteArray();
    }
}
